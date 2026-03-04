"""
GFLS Automation - FastAPI Backend
Wraps all processing functions from app.py and exposes them as REST endpoints.
Run with: uvicorn api:app --reload --port 8000
"""

from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List
import pandas as pd
import numpy as np
from io import BytesIO
import json
import warnings
warnings.filterwarnings('ignore')

# ── Import all processing functions from app.py ──────────────────────────────
from app import (
    df_format1, df_format2, df_format3, df_format4,
    regression_analysis,
    interpolate_col, extrapolate_col,
    pivot_with_assumptions,
    advanced_cluster_analysis,
)

app = FastAPI(title="GFLS Automation API", version="1.0.0")

# Allow the React frontend to call this API (adjust origin in production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── In-memory session store (replace with Redis/DB for production) ────────────
sessions: dict = {}


# ─────────────────────────────────────────────────────────────────────────────
# STEP 1 — Upload & Format
# ─────────────────────────────────────────────────────────────────────────────

@app.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    file_type: str = Form(...),          # "Excel" | "CSV"
    sheet_name: str = Form("Sheet1"),
    format_num: int = Form(...),         # 1 | 2 | 3 | 4
    column_mapping: Optional[str] = Form(None),  # JSON string for format 1
    session_id: str = Form(...),
):
    """
    Upload a file, apply a format transformation, and store the result in session.
    Returns a JSON preview and shape info.
    """
    contents = await file.read()
    buf = BytesIO(contents)

    try:
        mapping = json.loads(column_mapping) if column_mapping else None

        if format_num == 1:
            df = df_format1(buf, sheet_name=sheet_name,
                            column_mapping=mapping,
                            is_excel=(file_type == "Excel"))
        elif format_num == 2:
            df = df_format2(buf, sheet_name=sheet_name,
                            is_excel=(file_type == "Excel"))
        elif format_num == 3:
            df = df_format3(buf, sheet_name=sheet_name,
                            is_excel=(file_type == "Excel"))
        elif format_num == 4:
            df = df_format4(buf, sheet_name=sheet_name,
                            is_excel=(file_type == "Excel"))
        else:
            raise HTTPException(status_code=400, detail="Invalid format_num")

        # Persist to session
        sessions[session_id] = {"df": df}

        return {
            "rows": int(df.shape[0]),
            "cols": int(df.shape[1]),
            "columns": df.columns.tolist(),
            "countries": df["country"].unique().tolist() if "country" in df.columns else [],
            "metrics":   df["metric"].unique().tolist()  if "metric"  in df.columns else [],
            "preview": df.head(10).replace({np.nan: None}).to_dict(orient="records"),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/preview-columns")
async def preview_columns(
    file: UploadFile = File(...),
    file_type: str = Form(...),
    sheet_name: str = Form("Sheet1"),
):
    """Return the raw column names from an uploaded file so the UI can build the Format-1 mapping dropdowns."""
    contents = await file.read()
    buf = BytesIO(contents)
    try:
        if file_type == "Excel":
            df = pd.read_excel(buf, sheet_name=sheet_name, nrows=5)
        else:
            df = pd.read_csv(buf, nrows=5)
        return {"columns": df.columns.tolist(),
                "preview": df.replace({np.nan: None}).to_dict(orient="records")}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─────────────────────────────────────────────────────────────────────────────
# STEP 2 — Year Correction (Interpolate / Extrapolate)
# ─────────────────────────────────────────────────────────────────────────────

class YearCorrectionRequest(BaseModel):
    session_id: str
    ref_year: int = 2023
    fix_method: str = "Interpolate"       # "Interpolate" | "Extrapolate"
    interp_method: str = "linear"
    poly_order: int = 2
    ma_window: int = 3


@app.post("/year-correction")
async def year_correction(req: YearCorrectionRequest):
    """
    Pivot the session DataFrame, then interpolate or extrapolate missing values.
    Returns updated preview and appends corrected rows back to the session.
    """
    session = sessions.get(req.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found. Please re-upload your file.")

    df: pd.DataFrame = session["df"]

    try:
        pdf = pivot_with_assumptions(df, req.ref_year)

        if req.fix_method == "Interpolate":
            result = interpolate_col(pdf, df, peak_year=req.ref_year, method=req.interp_method)
        else:
            result = extrapolate_col(pdf, df, peak_year=req.ref_year,
                                     method=req.interp_method,
                                     order=req.poly_order,
                                     ma_window=req.ma_window)

        # Melt corrected pivot back to long format and append
        id_vars = [c for c in ["country", "source", "assumption"] if c in result.columns]
        metric_cols = [c for c in result.columns if c not in id_vars]
        long_df = result.reset_index().melt(
            id_vars=(["country"] if "country" not in result.columns else []) + id_vars,
            value_vars=metric_cols, var_name="metric", value_name="value"
        )
        long_df["year"] = req.ref_year
        long_df = long_df.reindex(columns=["country", "year", "metric", "value", "source", "assumption"])

        corrected = pd.concat([df, long_df], ignore_index=True) \
                      .sort_values(["country", "year", "metric"]) \
                      .reset_index(drop=True)

        sessions[req.session_id]["df"] = corrected

        original_missing = int(pdf.isnull().sum().sum())
        final_missing    = int(result.isnull().sum().sum())

        return {
            "original_missing": original_missing,
            "final_missing":    final_missing,
            "values_filled":    original_missing - final_missing,
            "shape": {"rows": int(corrected.shape[0]), "cols": int(corrected.shape[1])},
            "preview": corrected.head(10).replace({np.nan: None}).to_dict(orient="records"),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/download/{session_id}")
def download_excel(session_id: str, filename: str = "data.xlsx"):
    """Stream the current session DataFrame as an Excel file."""
    session = sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")
    df = session["df"]
    buf = BytesIO()
    with pd.ExcelWriter(buf, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="Formatted_Data")
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


# ─────────────────────────────────────────────────────────────────────────────
# STEP 3 — Regression
# ─────────────────────────────────────────────────────────────────────────────

class RegressionRequest(BaseModel):
    session_id: str
    country: str
    metric: str
    target_year: int
    method: str = "linear"
    poly_order: int = 2
    alpha: float = 1.0
    C: float = 1.0
    hidden_layers: str = "10"   # comma-separated


class AddPredictionRequest(BaseModel):
    session_id: str
    country: str
    metric: str
    year: int
    value: float


@app.post("/regression/predict")
async def predict(req: RegressionRequest):
    session = sessions.get(req.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")

    df: pd.DataFrame = session["df"]
    filtered = df[(df["country"] == req.country) & (df["metric"] == req.metric)].sort_values("year")

    if len(filtered) < 2:
        raise HTTPException(status_code=400, detail="Not enough data points for regression (need ≥ 2).")

    years  = filtered["year"].values
    values = filtered["value"].values

    try:
        hidden_layer_sizes = tuple(int(x) for x in req.hidden_layers.split(","))
    except Exception:
        hidden_layer_sizes = (10,)

    try:
        y_pred = regression_analysis(
            years=years, values=values, target_year=req.target_year,
            method=req.method, poly_order=req.poly_order,
            alpha=req.alpha, C=req.C,
            hidden_layer_sizes=hidden_layer_sizes,
        )
        return {"predicted_value": float(y_pred), "country": req.country,
                "metric": req.metric, "year": req.target_year, "method": req.method}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/regression/add-prediction")
async def add_prediction(req: AddPredictionRequest):
    session = sessions.get(req.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")

    df: pd.DataFrame = session["df"]
    new_row = pd.DataFrame([{
        "country": req.country, "year": req.year,
        "metric": req.metric,   "value": req.value,
        "source": "regression_prediction", "assumption": ""
    }])
    sessions[req.session_id]["df"] = pd.concat([df, new_row], ignore_index=True)
    return {"status": "added", "rows": int(sessions[req.session_id]["df"].shape[0])}


# ─────────────────────────────────────────────────────────────────────────────
# STEP 4 — Clustering & KNN
# ─────────────────────────────────────────────────────────────────────────────

class ClusterRequest(BaseModel):
    session_id: str
    ref_year: int = 2023
    selected_features: List[str]
    n_clusters: int = 3
    max_clusters: int = 6
    feature_weights: dict = {}


class KNNRequest(BaseModel):
    session_id: str
    ref_year: int = 2023
    selected_features: List[str]
    feature_weights: dict = {}


@app.post("/clustering/run")
async def run_clustering(req: ClusterRequest):
    session = sessions.get(req.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")

    df: pd.DataFrame = session["df"]

    try:
        from sklearn.preprocessing import StandardScaler
        from sklearn.cluster import KMeans
        from sklearn.metrics import silhouette_score

        pdf = pivot_with_assumptions(df, req.ref_year)
        pdf.reset_index(inplace=True)

        country_col = next((c for c in ["country", "Country", "COUNTRY"] if c in pdf.columns), None)

        missing_counts    = pdf[req.selected_features].isna().sum(axis=1)
        complete_data     = pdf[missing_counts == 0].copy()
        partial_data      = pdf[missing_counts == 1].copy()
        insufficient_data = pdf[missing_counts  > 1].copy()

        if len(complete_data) < 3:
            raise HTTPException(status_code=400, detail="Need at least 3 countries with complete data.")

        scaler   = StandardScaler()
        std_data = scaler.fit_transform(complete_data[req.selected_features])
        std_df   = pd.DataFrame(std_data, columns=req.selected_features)
        for feat in req.selected_features:
            std_df[feat] *= req.feature_weights.get(feat, 1.0)

        weighted = std_df.values
        kmeans   = KMeans(n_clusters=req.n_clusters, random_state=42, n_init=10)
        labels   = kmeans.fit_predict(weighted)
        complete_data = complete_data.copy()
        complete_data["Cluster"] = labels

        sil     = float(silhouette_score(weighted, labels))
        k_range = range(1, min(req.max_clusters + 1, len(complete_data)) + 1)
        inertia = []
        for k in k_range:
            km = KMeans(n_clusters=k, random_state=42, n_init=10)
            km.fit(weighted)
            inertia.append(float(km.inertia_))

        sessions[req.session_id]["clustering"] = {
            "complete_data":     complete_data,
            "partial_data":      partial_data,
            "weighted_data":     weighted,
            "scaler":            scaler,
            "cluster_labels":    labels,
            "selected_features": req.selected_features,
            "feature_weights":   req.feature_weights,
            "country_col":       country_col,
        }

        cluster_col = [country_col, "Cluster"] if country_col else ["Cluster"]
        return {
            "silhouette_score":       sil,
            "countries_clustered":    len(complete_data),
            "partial_countries":      len(partial_data),
            "insufficient_countries": len(insufficient_data),
            "features_used":          len(req.selected_features),
            "elbow": {"k": list(k_range), "inertia": inertia},
            "clusters": complete_data[cluster_col].replace({np.nan: None}).to_dict(orient="records"),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/clustering/knn")
async def run_knn(req: KNNRequest):
    session = sessions.get(req.session_id)
    if not session or "clustering" not in session:
        raise HTTPException(status_code=404, detail="Please run clustering first.")

    clust = session["clustering"]

    try:
        from sklearn.neighbors import KNeighborsClassifier

        complete = clust["complete_data"]
        partial  = clust["partial_data"]
        features = clust["selected_features"]
        labels   = clust["cluster_labels"]
        country_col = clust["country_col"]

        X_train = clust["weighted_data"]
        knn = KNeighborsClassifier(n_neighbors=min(5, len(complete)))
        knn.fit(X_train, labels)

        results = []
        for _, row in partial.iterrows():
            missing_feat = [f for f in features if pd.isna(row[f])][0]
            known_feats  = [f for f in features if f != missing_feat]

            # Impute missing with mean from complete data
            imputed = [row[f] if not pd.isna(row[f]) else float(complete[f].mean()) for f in features]
            # Scale & weight
            imputed_scaled = clust["scaler"].transform([imputed])[0]
            for i, feat in enumerate(features):
                imputed_scaled[i] *= req.feature_weights.get(feat, 1.0)

            probs = knn.predict_proba([imputed_scaled])[0]
            pred_class = int(knn.predict([imputed_scaled])[0])
            confidence = float(max(probs))

            results.append({
                "country":         row[country_col] if country_col else "Unknown",
                "predicted_cluster": pred_class,
                "confidence":      confidence,
                "missing_feature": missing_feat,
            })

        return {"knn_results": results, "classified": len(results)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/clustering/download/{session_id}")
def download_clustering(session_id: str):
    session = sessions.get(session_id)
    if not session or "clustering" not in session:
        raise HTTPException(status_code=404, detail="No clustering results found.")
    df = session["clustering"]["complete_data"]
    buf = BytesIO()
    df.to_csv(buf, index=False)
    buf.seek(0)
    return StreamingResponse(buf, media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="clustering_results.csv"'})


# ─────────────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api:app", host="0.0.0.0", port=8000, reload=True)
