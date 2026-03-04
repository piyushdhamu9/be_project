import { useState, useRef, useCallback } from "react";

// ── Change this to your FastAPI server address ────────────────────────────
const API_BASE = "http://localhost:8000";

// Simple unique session ID per browser session
const SESSION_ID = Math.random().toString(36).slice(2);

const STEPS = ["Data Upload", "Year Correction", "Regression", "Clustering"];
const FORMATS = [
  { id: 1, label: "Format 1", desc: "Same form, different labels" },
  { id: 2, label: "Format 2", desc: "Years in different columns" },
  { id: 3, label: "Format 3", desc: "Year in rows, metrics in columns" },
  { id: 4, label: "Format 4", desc: "Metric in columns with labelled years" },
];
const REGRESSION_METHODS = [
  "linear","polynomial","ridge","lasso",
  "logistic","decision_tree","random_forest","svm","neural_network",
];
const COLUMN_FIELDS = ["country","year","metric","value","source","assumption"];
const INTERP_METHODS = ["linear","polynomial","spline","nearest_neighbour","piecewise_constant","logarithmic"];

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Syne:wght@400;600;700;800&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg:#0b0c0f; --surface:#13151a; --card:#1a1d25; --border:#2a2d38;
    --border2:#353848; --accent:#e8c547; --accent2:#f0d97a;
    --text:#e4e6ee; --muted:#7a7f96; --danger:#e05c5c;
    --success:#4ecb8d; --info:#5c9fe0;
    --font-head:'Syne',sans-serif; --font-mono:'DM Mono',monospace; --radius:6px;
  }
  body { background:var(--bg); color:var(--text); font-family:var(--font-mono); }
  .app { min-height:100vh; display:flex; flex-direction:column; }
  .header {
    border-bottom:1px solid var(--border); padding:0 40px; height:64px;
    display:flex; align-items:center; justify-content:space-between;
    background:var(--surface); position:sticky; top:0; z-index:100;
  }
  .logo { font-family:var(--font-head); font-weight:800; font-size:20px;
    letter-spacing:-0.5px; color:var(--accent); display:flex; align-items:center; gap:10px; }
  .logo-sub { font-family:var(--font-mono); font-size:11px; font-weight:300;
    color:var(--muted); text-transform:uppercase; letter-spacing:2px; margin-top:2px; }
  .step-nav { display:flex; gap:0; border-bottom:1px solid var(--border);
    background:var(--surface); padding:0 40px; overflow-x:auto; }
  .step-btn { padding:14px 28px; background:none; border:none; cursor:pointer;
    font-family:var(--font-mono); font-size:12px; letter-spacing:1.5px;
    text-transform:uppercase; color:var(--muted); border-bottom:2px solid transparent;
    transition:all 0.2s; white-space:nowrap; display:flex; align-items:center; gap:8px; }
  .step-btn:hover { color:var(--text); }
  .step-btn.active { color:var(--accent); border-bottom-color:var(--accent); }
  .step-btn.done { color:var(--success); }
  .step-num { width:20px; height:20px; border-radius:50%; display:flex;
    align-items:center; justify-content:center; font-size:10px; font-weight:500;
    background:var(--border); color:var(--muted); }
  .step-btn.active .step-num { background:var(--accent); color:#000; }
  .step-btn.done .step-num { background:var(--success); color:#000; }
  .main { flex:1; padding:40px; max-width:1100px; margin:0 auto; width:100%; }
  .section-title { font-family:var(--font-head); font-size:28px; font-weight:700;
    letter-spacing:-0.5px; margin-bottom:4px; }
  .section-sub { font-size:12px; color:var(--muted); margin-bottom:32px; letter-spacing:0.5px; }
  .card { background:var(--card); border:1px solid var(--border); border-radius:var(--radius);
    padding:24px; margin-bottom:20px; }
  .card-title { font-family:var(--font-head); font-size:13px; font-weight:700;
    text-transform:uppercase; letter-spacing:1.5px; color:var(--muted); margin-bottom:16px; }
  .upload-zone { border:1.5px dashed var(--border2); border-radius:var(--radius); padding:40px;
    text-align:center; cursor:pointer; transition:all 0.2s; background:var(--surface); }
  .upload-zone:hover,.upload-zone.drag { border-color:var(--accent); background:rgba(232,197,71,0.04); }
  .upload-icon { font-size:32px; margin-bottom:12px; }
  .upload-label { font-family:var(--font-head); font-size:16px; font-weight:600;
    color:var(--text); margin-bottom:6px; }
  .upload-hint { font-size:11px; color:var(--muted); letter-spacing:0.5px; }
  .upload-success { display:flex; align-items:center; gap:12px;
    background:rgba(78,203,141,0.08); border:1px solid rgba(78,203,141,0.25);
    border-radius:var(--radius); padding:14px 18px; margin-top:14px; }
  .radio-group { display:flex; gap:10px; margin-bottom:20px; }
  .radio-btn { padding:8px 20px; border:1.5px solid var(--border2); border-radius:var(--radius);
    background:none; cursor:pointer; font-family:var(--font-mono); font-size:12px;
    letter-spacing:0.5px; color:var(--muted); transition:all 0.15s; }
  .radio-btn:hover { border-color:var(--accent); color:var(--text); }
  .radio-btn.selected { border-color:var(--accent); color:var(--accent); background:rgba(232,197,71,0.07); }
  .input-label { font-size:11px; color:var(--muted); letter-spacing:1px;
    text-transform:uppercase; margin-bottom:6px; }
  .input-field { width:100%; padding:10px 14px; background:var(--surface);
    border:1.5px solid var(--border2); border-radius:var(--radius); color:var(--text);
    font-family:var(--font-mono); font-size:13px; outline:none; transition:border-color 0.15s; }
  .input-field:focus { border-color:var(--accent); }
  .input-group { margin-bottom:16px; }
  select.input-field { cursor:pointer; }
  select.input-field option { background:var(--card); }
  .format-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:20px; }
  .format-card { border:1.5px solid var(--border); border-radius:var(--radius); padding:16px;
    cursor:pointer; transition:all 0.15s; background:var(--surface); text-align:left; }
  .format-card:hover { border-color:var(--accent); }
  .format-card.selected { border-color:var(--accent); background:rgba(232,197,71,0.06); }
  .format-card-num { font-family:var(--font-head); font-size:22px; font-weight:800;
    color:var(--border2); transition:color 0.15s; line-height:1; margin-bottom:8px; }
  .format-card.selected .format-card-num,.format-card:hover .format-card-num { color:var(--accent); }
  .format-card-label { font-size:12px; font-weight:500; color:var(--text); margin-bottom:4px; }
  .format-card-desc { font-size:10px; color:var(--muted); letter-spacing:0.3px; }
  .mapping-grid { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
  .btn { padding:10px 22px; border-radius:var(--radius); font-family:var(--font-mono);
    font-size:12px; letter-spacing:0.8px; text-transform:uppercase; cursor:pointer;
    border:none; transition:all 0.15s; font-weight:500; display:inline-flex; align-items:center; gap:8px; }
  .btn:disabled { opacity:0.4; cursor:not-allowed; }
  .btn-primary { background:var(--accent); color:#000; }
  .btn-primary:hover:not(:disabled) { background:var(--accent2); }
  .btn-secondary { background:none; color:var(--muted); border:1.5px solid var(--border2); }
  .btn-secondary:hover:not(:disabled) { border-color:var(--text); color:var(--text); }
  .btn-success { background:var(--success); color:#000; }
  .btn-row { display:flex; gap:10px; align-items:center; flex-wrap:wrap; margin-top:16px; }
  .alert { padding:12px 16px; border-radius:var(--radius); font-size:12px;
    display:flex; align-items:flex-start; gap:10px; margin-bottom:16px; }
  .alert-info { background:rgba(92,159,224,0.08); border:1px solid rgba(92,159,224,0.2); color:var(--info); }
  .alert-success { background:rgba(78,203,141,0.08); border:1px solid rgba(78,203,141,0.2); color:var(--success); }
  .alert-warn { background:rgba(232,197,71,0.08); border:1px solid rgba(232,197,71,0.2); color:var(--accent); }
  .alert-error { background:rgba(224,92,92,0.08); border:1px solid rgba(224,92,92,0.2); color:var(--danger); }
  .mapping-table { width:100%; border-collapse:collapse; font-size:12px; }
  .mapping-table th { text-align:left; padding:8px 12px; background:var(--surface);
    color:var(--muted); border-bottom:1px solid var(--border); font-weight:400;
    letter-spacing:1px; text-transform:uppercase; font-size:10px; }
  .mapping-table td { padding:8px 12px; border-bottom:1px solid var(--border); }
  .mapping-table tr:last-child td { border-bottom:none; }
  .badge { display:inline-block; padding:2px 8px; border-radius:3px; font-size:10px;
    background:rgba(232,197,71,0.12); color:var(--accent); letter-spacing:0.5px; }
  .checkbox-row { display:flex; align-items:center; gap:10px; cursor:pointer; margin-bottom:16px; }
  .checkbox-box { width:18px; height:18px; border:1.5px solid var(--border2); border-radius:3px;
    display:flex; align-items:center; justify-content:center; transition:all 0.15s; flex-shrink:0; }
  .checkbox-box.checked { background:var(--accent); border-color:var(--accent); }
  .method-grid { display:flex; flex-wrap:wrap; gap:8px; margin-bottom:20px; }
  .method-chip { padding:7px 14px; border:1.5px solid var(--border2); border-radius:20px;
    font-size:11px; letter-spacing:0.5px; cursor:pointer; color:var(--muted);
    transition:all 0.15s; background:none; font-family:var(--font-mono); }
  .method-chip:hover { border-color:var(--accent); color:var(--text); }
  .method-chip.selected { border-color:var(--accent); color:var(--accent); background:rgba(232,197,71,0.07); }
  .slider-row { display:flex; align-items:center; gap:12px; }
  .slider { flex:1; -webkit-appearance:none; height:4px; background:var(--border2);
    border-radius:2px; outline:none; }
  .slider::-webkit-slider-thumb { -webkit-appearance:none; width:16px; height:16px;
    border-radius:50%; background:var(--accent); cursor:pointer; }
  .slider-val { min-width:32px; text-align:center; font-size:14px; font-weight:500; color:var(--accent); }
  .prediction-box { background:var(--surface); border:1px solid var(--border);
    border-left:3px solid var(--accent); border-radius:var(--radius); padding:20px;
    margin-top:16px; animation:fadeIn 0.3s ease; }
  .prediction-value { font-family:var(--font-head); font-size:36px; font-weight:800;
    color:var(--accent); line-height:1; }
  .tag-list { display:flex; flex-wrap:wrap; gap:6px; margin-bottom:16px; }
  .tag { padding:5px 12px; border-radius:3px; font-size:11px; cursor:pointer;
    transition:all 0.15s; border:1.5px solid var(--border2); color:var(--muted);
    background:none; font-family:var(--font-mono); }
  .tag:hover { border-color:var(--info); color:var(--info); }
  .tag.active { border-color:var(--info); color:var(--info); background:rgba(92,159,224,0.07); }
  .divider { height:1px; background:var(--border); margin:28px 0; }
  .two-col { display:grid; grid-template-columns:1fr 1fr; gap:20px; }
  .stat-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin-bottom:16px; }
  .stat-box { background:var(--surface); border:1px solid var(--border);
    border-radius:var(--radius); padding:14px 16px; }
  .stat-val { font-family:var(--font-head); font-size:22px; font-weight:800; }
  .spinner { display:inline-block; width:14px; height:14px; border:2px solid rgba(255,255,255,0.2);
    border-top-color:currentColor; border-radius:50%; animation:spin 0.6s linear infinite; }
  .data-table-wrap { overflow-x:auto; }
  .data-table { width:100%; border-collapse:collapse; font-size:11px; }
  .data-table th { padding:6px 10px; background:var(--surface); color:var(--muted);
    border-bottom:1px solid var(--border); text-align:left; font-weight:400;
    letter-spacing:0.8px; text-transform:uppercase; font-size:10px; white-space:nowrap; }
  .data-table td { padding:6px 10px; border-bottom:1px solid var(--border);
    color:var(--text); white-space:nowrap; }
  .data-table tr:last-child td { border-bottom:none; }
  @media(max-width:640px) {
    .two-col,.format-grid,.mapping-grid { grid-template-columns:1fr; }
    .stat-grid { grid-template-columns:1fr 1fr; }
    .main { padding:20px; }
  }
  @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1} }
  @keyframes spin { to { transform:rotate(360deg); } }
`;

// ── Atoms ─────────────────────────────────────────────────────────────────────
const Alert = ({ type="info", children }) => {
  const icons = { info:"ℹ", success:"✓", warn:"⚠", error:"✕" };
  return <div className={`alert alert-${type}`}><span>{icons[type]}</span><span>{children}</span></div>;
};
const Spinner = () => <span className="spinner" />;
const Divider = () => <div className="divider" />;
const Label = ({ children }) => <div className="input-label">{children}</div>;

function SelectField({ label, options, value, onChange, disabled }) {
  return (
    <div className="input-group">
      {label && <Label>{label}</Label>}
      <select className="input-field" value={value} onChange={e=>onChange(e.target.value)} disabled={disabled}>
        {options.map(o => <option key={o.value??o} value={o.value??o}>{o.label??o}</option>)}
      </select>
    </div>
  );
}

function InputField({ label, type="text", value, onChange, min, max, step, placeholder, disabled }) {
  return (
    <div className="input-group">
      {label && <Label>{label}</Label>}
      <input className="input-field" type={type} value={value}
        onChange={e=>onChange(type==="number"?Number(e.target.value):e.target.value)}
        min={min} max={max} step={step} placeholder={placeholder} disabled={disabled} />
    </div>
  );
}

function Checkbox({ checked, onChange, children }) {
  return (
    <div className="checkbox-row" onClick={()=>onChange(!checked)}>
      <div className={`checkbox-box${checked?" checked":""}`}>
        {checked && <span style={{color:"#000",fontSize:11,fontWeight:700}}>✓</span>}
      </div>
      <span style={{fontSize:13,color:"var(--text)"}}>{children}</span>
    </div>
  );
}

function StatBox({ label, value, color }) {
  return (
    <div className="stat-box" style={{borderLeft:`3px solid ${color||"var(--accent)"}`}}>
      <div style={{fontSize:10,color:"var(--muted)",textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>{label}</div>
      <div className="stat-val" style={{color:color||"var(--accent)"}}>{value}</div>
    </div>
  );
}

function DataTable({ rows, columns }) {
  if (!rows || rows.length===0) return <Alert type="info">No data to preview.</Alert>;
  const cols = columns || Object.keys(rows[0]);
  return (
    <div className="data-table-wrap">
      <table className="data-table">
        <thead><tr>{cols.map(c=><th key={c}>{c}</th>)}</tr></thead>
        <tbody>{rows.map((r,i)=>(
          <tr key={i}>{cols.map(c=><td key={c}>{r[c]==null?"—":String(r[c])}</td>)}</tr>
        ))}</tbody>
      </table>
    </div>
  );
}

// ── API helpers ───────────────────────────────────────────────────────────────
async function apiFetch(path, opts={}) {
  const res = await fetch(API_BASE+path, opts);
  if (!res.ok) {
    const err = await res.json().catch(()=>({detail:res.statusText}));
    throw new Error(err.detail||"Request failed");
  }
  return res.json();
}

// ── Step 1: Upload ────────────────────────────────────────────────────────────
function StepUpload({ onDone }) {
  const fileRef = useRef();
  const [drag,setDrag] = useState(false);
  const [fileType,setFileType] = useState("Excel");
  const [sheetName,setSheetName] = useState("Sheet1");
  const [file,setFile] = useState(null);
  const [format,setFormat] = useState(null);
  const [rawCols,setRawCols] = useState([]);
  const [mapping,setMapping] = useState({});
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState(null);
  const [result,setResult] = useState(null);

  const handleFile = async f => {
    if (!f) return;
    setFile(f); setResult(null); setError(null);
    const fd = new FormData();
    fd.append("file",f); fd.append("file_type",fileType); fd.append("sheet_name",sheetName);
    try {
      const d = await apiFetch("/preview-columns",{method:"POST",body:fd});
      setRawCols(d.columns);
      const def={};
      COLUMN_FIELDS.forEach((field,i)=>{def[field]=d.columns[i]||d.columns[0];});
      setMapping(def);
    } catch { setRawCols([]); }
  };

  const handleApply = async () => {
    if (!file||!format) return;
    setLoading(true); setError(null);
    const fd = new FormData();
    fd.append("file",file); fd.append("file_type",fileType);
    fd.append("sheet_name",sheetName); fd.append("format_num",format);
    fd.append("session_id",SESSION_ID);
    if (format===1) fd.append("column_mapping",JSON.stringify(
      Object.fromEntries(COLUMN_FIELDS.map(f=>[mapping[f],f]))
    ));
    try {
      const d = await apiFetch("/upload",{method:"POST",body:fd});
      setResult(d); onDone(d);
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <>
      <div className="section-title">Data Collation</div>
      <div className="section-sub">Upload a file and choose a formatting option to standardise it</div>

      <div className="card">
        <div className="card-title">File Type</div>
        <div className="radio-group">
          {["Excel","CSV"].map(t=>(
            <button key={t} className={`radio-btn${fileType===t?" selected":""}`}
              onClick={()=>{setFileType(t);setFile(null);setResult(null);}}>
              {t}
            </button>
          ))}
        </div>

        <div className={`upload-zone${drag?" drag":""}`}
          onClick={()=>fileRef.current.click()}
          onDragOver={e=>{e.preventDefault();setDrag(true);}}
          onDragLeave={()=>setDrag(false)}
          onDrop={e=>{e.preventDefault();setDrag(false);handleFile(e.dataTransfer.files[0]);}}>
          <div className="upload-icon">📂</div>
          <div className="upload-label">{fileType==="CSV"?"Drop CSV file here":"Drop Excel file here"}</div>
          <div className="upload-hint">{fileType==="CSV"?".csv":".xlsx, .xls"} · click or drag & drop</div>
          <input ref={fileRef} type="file" style={{display:"none"}}
            accept={fileType==="CSV"?".csv":".xlsx,.xls"}
            onChange={e=>handleFile(e.target.files[0])} />
        </div>

        {file && (
          <div className="upload-success">
            <span style={{color:"var(--success)",fontSize:18}}>✓</span>
            <div>
              <div style={{fontSize:13,fontWeight:500,color:"var(--success)"}}>{file.name}</div>
              <div style={{fontSize:11,color:"var(--muted)"}}>{(file.size/1024).toFixed(1)} KB</div>
            </div>
          </div>
        )}

        {fileType==="Excel" && file && (
          <div style={{marginTop:16}}>
            <InputField label="Sheet Name" value={sheetName} onChange={setSheetName} placeholder="Sheet1"/>
          </div>
        )}
      </div>

      {file && (
        <div className="card">
          <div className="card-title">Formatting Option</div>
          <div className="format-grid">
            {FORMATS.map(f=>(
              <div key={f.id} className={`format-card${format===f.id?" selected":""}`} onClick={()=>setFormat(f.id)}>
                <div className="format-card-num">{f.id}</div>
                <div className="format-card-label">{f.label}</div>
                <div className="format-card-desc">{f.desc}</div>
              </div>
            ))}
          </div>

          {format===1 && rawCols.length>0 && (
            <>
              <Divider/>
              <div className="card-title">Column Mapping</div>
              <Alert type="info">Map your file's columns to the required standard fields.</Alert>
              <div className="mapping-grid">
                {COLUMN_FIELDS.map(field=>(
                  <SelectField key={field} label={`${field.charAt(0).toUpperCase()+field.slice(1)} column`}
                    options={rawCols} value={mapping[field]||rawCols[0]}
                    onChange={v=>setMapping(m=>({...m,[field]:v}))} />
                ))}
              </div>
              <table className="mapping-table">
                <thead><tr><th>Your Column</th><th>Maps To</th></tr></thead>
                <tbody>{COLUMN_FIELDS.map(field=>(
                  <tr key={field}><td>{mapping[field]||"—"}</td><td><span className="badge">{field}</span></td></tr>
                ))}</tbody>
              </table>
            </>
          )}

          {error && <Alert type="error">{error}</Alert>}

          <div className="btn-row" style={{marginTop:16}}>
            <button className="btn btn-primary" onClick={handleApply} disabled={loading||!format}>
              {loading?<><Spinner/> Processing…</>:"Apply Format →"}
            </button>
          </div>
        </div>
      )}

      {result && (
        <div className="card">
          <div className="card-title">Formatted Data Preview</div>
          <div className="stat-grid">
            <StatBox label="Rows" value={result.rows}/>
            <StatBox label="Columns" value={result.cols} color="var(--info)"/>
            <StatBox label="Countries" value={result.countries?.length||"—"} color="var(--success)"/>
          </div>
          <DataTable rows={result.preview} columns={result.columns}/>
        </div>
      )}

      {!file && <Alert type="warn">Upload a file above to configure formatting options.</Alert>}
    </>
  );
}

// ── Step 2: Year Correction ───────────────────────────────────────────────────
function StepYearCorrection({ uploadResult, onDone }) {
  const [apply,setApply] = useState(false);
  const [refYear,setRefYear] = useState(2023);
  const [fixMethod,setFixMethod] = useState("Interpolate");
  const [interpMethod,setInterpMethod] = useState("linear");
  const [polyOrder,setPolyOrder] = useState(2);
  const [maWindow,setMaWindow] = useState(3);
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState(null);
  const [result,setResult] = useState(null);

  const handleRun = async () => {
    setLoading(true); setError(null);
    try {
      const d = await apiFetch("/year-correction",{
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          session_id:SESSION_ID, ref_year:refYear, fix_method:fixMethod,
          interp_method:interpMethod, poly_order:polyOrder, ma_window:maWindow,
        }),
      });
      setResult(d); onDone(d);
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };

  if (!uploadResult) return <Alert type="warn">Complete Step 1 before proceeding.</Alert>;

  return (
    <>
      <div className="section-title">Year Correction</div>
      <div className="section-sub">Optionally fill missing values via interpolation or extrapolation</div>

      <div className="card">
        <Checkbox checked={apply} onChange={setApply}>Apply Year Correction (Optional)</Checkbox>

        {apply && (
          <>
            <InputField label="Reference / Correct / Latest Year" type="number"
              value={refYear} onChange={setRefYear} min={1900} max={2100} step={1}/>

            <div className="card-title" style={{marginTop:8}}>Fill Method</div>
            <div className="radio-group">
              {["Interpolate","Extrapolate"].map(m=>(
                <button key={m} className={`radio-btn${fixMethod===m?" selected":""}`}
                  onClick={()=>setFixMethod(m)}>{m}</button>
              ))}
            </div>

            <SelectField label={`${fixMethod} Method`}
              options={INTERP_METHODS} value={interpMethod} onChange={setInterpMethod}/>

            {fixMethod==="Extrapolate" && (
              <div className="two-col">
                {interpMethod==="polynomial" && (
                  <InputField label="Polynomial Order" type="number"
                    value={polyOrder} onChange={setPolyOrder} min={1} max={5}/>
                )}
                <InputField label="Moving Average Window" type="number"
                  value={maWindow} onChange={setMaWindow} min={1} max={10}/>
              </div>
            )}

            {error && <Alert type="error">{error}</Alert>}

            <div className="btn-row">
              <button className="btn btn-primary" onClick={handleRun} disabled={loading}>
                {loading?<><Spinner/> Running…</>:"Run Correction →"}
              </button>
              <button className="btn btn-secondary" onClick={()=>onDone(null)}>Skip</button>
            </div>
          </>
        )}

        {!apply && (
          <>
            <Alert type="info">No correction will be applied. Proceeding with raw formatted data.</Alert>
            <div className="btn-row">
              <button className="btn btn-primary" onClick={()=>onDone(null)}>Continue →</button>
            </div>
          </>
        )}
      </div>

      {result && (
        <div className="card">
          <div className="card-title">Correction Summary</div>
          <div className="stat-grid">
            <StatBox label="Original Missing" value={result.original_missing} color="var(--danger)"/>
            <StatBox label="Values Filled" value={result.values_filled} color="var(--success)"/>
            <StatBox label="Remaining Missing" value={result.final_missing} color="var(--accent)"/>
          </div>
          <DataTable rows={result.preview}/>
          <div className="btn-row">
            <button className="btn btn-success"
              onClick={()=>window.open(`${API_BASE}/download/${SESSION_ID}?filename=corrected_data.xlsx`)}>
              📥 Download Corrected Data
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ── Step 3: Regression ────────────────────────────────────────────────────────
function StepRegression({ uploadResult }) {
  const countries = uploadResult?.countries||[];
  const metrics   = uploadResult?.metrics||[];

  const [country,setCountry] = useState(countries[0]||"");
  const [metric,setMetric]   = useState(metrics[0]||"");
  const [method,setMethod]   = useState("linear");
  const [targetYear,setTargetYear] = useState(2025);
  const [polyOrder,setPolyOrder]   = useState(2);
  const [alpha,setAlpha]           = useState(1.0);
  const [C,setC]                   = useState(1.0);
  const [hiddenLayers,setHiddenLayers] = useState("10");
  const [loading,setLoading]       = useState(false);
  const [error,setError]           = useState(null);
  const [prediction,setPrediction] = useState(null);
  const [predAdded,setPredAdded]   = useState(false);
  const [addLoading,setAddLoading] = useState(false);

  const handlePredict = async () => {
    setLoading(true); setError(null); setPrediction(null);
    try {
      const d = await apiFetch("/regression/predict",{
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          session_id:SESSION_ID, country, metric, target_year:targetYear,
          method, poly_order:polyOrder, alpha, C, hidden_layers:hiddenLayers,
        }),
      });
      setPrediction(d); setPredAdded(false);
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const handleAddPrediction = async () => {
    if (!prediction) return;
    setAddLoading(true);
    try {
      await apiFetch("/regression/add-prediction",{
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          session_id:SESSION_ID, country:prediction.country,
          metric:prediction.metric, year:prediction.year, value:prediction.predicted_value,
        }),
      });
      setPredAdded(true);
    } catch(e) { setError(e.message); }
    finally { setAddLoading(false); }
  };

  if (!uploadResult) return <Alert type="warn">Complete Step 1 before proceeding.</Alert>;

  return (
    <>
      <div className="section-title">Regression Analysis</div>
      <div className="section-sub">Fit a model on historical data and predict future values</div>

      <div className="two-col">
        <div className="card">
          <div className="card-title">Filter</div>
          {countries.length>0
            ?<SelectField label="Country" options={countries} value={country} onChange={setCountry}/>
            :<InputField label="Country" value={country} onChange={setCountry} placeholder="e.g. Germany"/>
          }
          {metrics.length>0
            ?<SelectField label="Metric" options={metrics} value={metric} onChange={setMetric}/>
            :<InputField label="Metric" value={metric} onChange={setMetric} placeholder="e.g. GDP"/>
          }
        </div>
        <div className="card">
          <div className="card-title">Target Year</div>
          <InputField label="Predict for Year" type="number"
            value={targetYear} onChange={setTargetYear} min={1900} max={2200} step={1}/>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Regression Method</div>
        <div className="method-grid">
          {REGRESSION_METHODS.map(m=>(
            <button key={m} className={`method-chip${method===m?" selected":""}`}
              onClick={()=>setMethod(m)}>{m.replace(/_/g," ")}</button>
          ))}
        </div>

        {method==="polynomial" && (
          <div style={{maxWidth:280}}>
            <Label>Polynomial Order</Label>
            <div className="slider-row">
              <input type="range" className="slider" min={2} max={5} step={1}
                value={polyOrder} onChange={e=>setPolyOrder(Number(e.target.value))}/>
              <span className="slider-val">{polyOrder}</span>
            </div>
          </div>
        )}
        {["ridge","lasso"].includes(method) && (
          <div style={{maxWidth:280}}>
            <InputField label="Alpha (Regularization Strength)" type="number"
              value={alpha} onChange={setAlpha} min={0} step={0.1}/>
          </div>
        )}
        {["svm","logistic"].includes(method) && (
          <div style={{maxWidth:280}}>
            <InputField label="C (Regularization Parameter)" type="number"
              value={C} onChange={setC} min={0} step={0.1}/>
          </div>
        )}
        {method==="neural_network" && (
          <div style={{maxWidth:280}}>
            <InputField label="Hidden Layer Sizes (comma-sep)" value={hiddenLayers}
              onChange={setHiddenLayers} placeholder="10,20,10"/>
          </div>
        )}

        {error && <Alert type="error">{error}</Alert>}

        <div className="btn-row" style={{marginTop:20}}>
          <button className="btn btn-primary" onClick={handlePredict} disabled={loading}>
            {loading?<><Spinner/> Running…</>:"Run Prediction →"}
          </button>
        </div>
      </div>

      {prediction && (
        <div className="prediction-box">
          <div style={{fontSize:11,color:"var(--muted)",textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>
            Predicted Value
          </div>
          <div className="prediction-value">{Number(prediction.predicted_value).toFixed(4)}</div>
          <div style={{fontSize:11,color:"var(--muted)",marginTop:6}}>
            {prediction.country} · {prediction.metric} · {prediction.year} · {prediction.method}
          </div>
          <div className="btn-row" style={{marginTop:16}}>
            {!predAdded
              ?<button className="btn btn-secondary" onClick={handleAddPrediction} disabled={addLoading}>
                  {addLoading?<><Spinner/> Adding…</>:"+ Add to Data Table"}
                </button>
              :<Alert type="success">Prediction added to the data table.</Alert>
            }
            <button className="btn btn-success"
              onClick={()=>window.open(`${API_BASE}/download/${SESSION_ID}?filename=data_with_predictions.xlsx`)}>
              📥 Download Data Table
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ── Step 4: Clustering ────────────────────────────────────────────────────────
function StepClustering({ uploadResult }) {
  const availableFeatures = uploadResult?.metrics||
    ["GDP","Population","CO2 Emissions","Life Expectancy","Trade Balance","Inflation"];

  const [clusterYear,setClusterYear] = useState(2023);
  const [selectedFeatures,setSelectedFeatures] = useState(availableFeatures.slice(0,2));
  const [nClusters,setNClusters]     = useState(3);
  const [maxClusters,setMaxClusters] = useState(6);
  const [weights,setWeights]         = useState({});
  const [loading,setLoading]         = useState(false);
  const [knnLoading,setKnnLoading]   = useState(false);
  const [error,setError]             = useState(null);
  const [result,setResult]           = useState(null);
  const [knnResult,setKnnResult]     = useState(null);

  const toggleFeature = f =>
    setSelectedFeatures(prev => prev.includes(f)?prev.filter(x=>x!==f):[...prev,f]);

  const handleCluster = async () => {
    setLoading(true); setError(null); setResult(null); setKnnResult(null);
    try {
      const d = await apiFetch("/clustering/run",{
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          session_id:SESSION_ID, ref_year:clusterYear,
          selected_features:selectedFeatures, n_clusters:nClusters,
          max_clusters:maxClusters, feature_weights:weights,
        }),
      });
      setResult(d);
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const handleKNN = async () => {
    setKnnLoading(true); setError(null);
    try {
      const d = await apiFetch("/clustering/knn",{
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          session_id:SESSION_ID, ref_year:clusterYear,
          selected_features:selectedFeatures, feature_weights:weights,
        }),
      });
      setKnnResult(d);
    } catch(e) { setError(e.message); }
    finally { setKnnLoading(false); }
  };

  if (!uploadResult) return <Alert type="warn">Complete Step 1 before proceeding.</Alert>;

  return (
    <>
      <div className="section-title">Data Clustering</div>
      <div className="section-sub">K-Means clustering with optional KNN classification for partial-data countries</div>

      <div className="card">
        <div style={{maxWidth:280}}>
          <InputField label="Year to Review" type="number"
            value={clusterYear} onChange={setClusterYear} min={1900} max={2100} step={1}/>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Feature Selection</div>
        <div className="tag-list">
          {availableFeatures.map(f=>(
            <button key={f} className={`tag${selectedFeatures.includes(f)?" active":""}`}
              onClick={()=>toggleFeature(f)}>{f}</button>
          ))}
        </div>

        {selectedFeatures.length>=2 && (
          <>
            <Divider/>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16,marginBottom:20}}>
              <div>
                <Label>Number of Clusters</Label>
                <div className="slider-row">
                  <input type="range" className="slider" min={2} max={8} step={1}
                    value={nClusters} onChange={e=>setNClusters(Number(e.target.value))}/>
                  <span className="slider-val">{nClusters}</span>
                </div>
              </div>
              <div>
                <Label>Max Clusters (Elbow)</Label>
                <div className="slider-row">
                  <input type="range" className="slider" min={nClusters} max={12} step={1}
                    value={maxClusters} onChange={e=>setMaxClusters(Number(e.target.value))}/>
                  <span className="slider-val">{maxClusters}</span>
                </div>
              </div>
            </div>

            <div className="card-title">Feature Weights</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:12,marginBottom:20}}>
              {selectedFeatures.map(f=>(
                <div key={f} style={{flex:"0 0 140px"}}>
                  <InputField label={f} type="number"
                    value={weights[f]??1} onChange={v=>setWeights(w=>({...w,[f]:v}))}
                    min={0} step={0.1}/>
                </div>
              ))}
            </div>

            {error && <Alert type="error">{error}</Alert>}

            <div className="btn-row">
              <button className="btn btn-primary" onClick={handleCluster} disabled={loading}>
                {loading?<><Spinner/> Clustering…</>:"🔄 Run Clustering"}
              </button>
              <button className="btn btn-secondary" onClick={handleKNN}
                disabled={knnLoading||!result}>
                {knnLoading?<><Spinner/> Classifying…</>:"🤖 Run KNN Classification"}
              </button>
            </div>
          </>
        )}
        {selectedFeatures.length<2 && <Alert type="warn">Select at least 2 features to enable clustering.</Alert>}
      </div>

      {result && (
        <div className="card">
          <div className="card-title">Clustering Results</div>
          <div className="stat-grid">
            <StatBox label="Silhouette Score" value={result.silhouette_score?.toFixed(3)}/>
            <StatBox label="Countries Clustered" value={result.countries_clustered} color="var(--success)"/>
            <StatBox label="Partial (KNN)" value={result.partial_countries} color="var(--info)"/>
            <StatBox label="Insufficient (dropped)" value={result.insufficient_countries} color="var(--danger)"/>
            <StatBox label="Features Used" value={result.features_used} color="var(--accent2)"/>
            <StatBox label="Clusters" value={nClusters}/>
          </div>
          {result.clusters?.length>0 && (
            <>
              <div className="card-title" style={{marginTop:16}}>Cluster Assignments</div>
              <DataTable rows={result.clusters.slice(0,20)}/>
              {result.clusters.length>20 && (
                <div style={{fontSize:11,color:"var(--muted)",marginTop:8}}>
                  Showing first 20 of {result.clusters.length} countries
                </div>
              )}
            </>
          )}
          <div className="btn-row" style={{marginTop:16}}>
            <button className="btn btn-success"
              onClick={()=>window.open(`${API_BASE}/clustering/download/${SESSION_ID}`)}>
              📥 Download Clustering Results
            </button>
          </div>
        </div>
      )}

      {knnResult && (
        <div className="card">
          <div className="card-title">KNN Classification Results</div>
          <Alert type="success">{knnResult.classified} partial-data countries classified by KNN.</Alert>
          <DataTable rows={knnResult.knn_results}/>
        </div>
      )}
    </>
  );
}

// ── App Shell ─────────────────────────────────────────────────────────────────
export default function App() {
  const [activeStep,setActiveStep] = useState(0);
  const [uploadResult,setUploadResult] = useState(null);
  const [yearDone,setYearDone] = useState(false);

  const stepDone = [!!uploadResult, yearDone, false, false];
  const goNext = () => setActiveStep(s=>Math.min(s+1,STEPS.length-1));

  return (
    <>
      <style>{styles}</style>
      <div className="app">
        <header className="header">
          <div>
            <div className="logo"><span>⬡</span> GFLS</div>
            <div className="logo-sub">Global Forecasting & Learning System · Automation UI</div>
          </div>
          <div style={{fontSize:11,color:"var(--muted)"}}>
            Session: <span style={{color:"var(--accent)",fontFamily:"var(--font-mono)"}}>{SESSION_ID}</span>
          </div>
        </header>

        <nav className="step-nav">
          {STEPS.map((name,i)=>(
            <button key={i}
              className={`step-btn${activeStep===i?" active":""}${stepDone[i]&&activeStep!==i?" done":""}`}
              onClick={()=>setActiveStep(i)}>
              <span className="step-num">{stepDone[i]&&activeStep!==i?"✓":i+1}</span>
              {name}
            </button>
          ))}
        </nav>

        <main className="main">
          {activeStep===0 && <StepUpload onDone={d=>{setUploadResult(d);goNext();}}/>}
          {activeStep===1 && <StepYearCorrection uploadResult={uploadResult} onDone={()=>{setYearDone(true);goNext();}}/>}
          {activeStep===2 && <StepRegression uploadResult={uploadResult}/>}
          {activeStep===3 && <StepClustering uploadResult={uploadResult}/>}

          <div className="btn-row" style={{marginTop:32,paddingTop:20,borderTop:"1px solid var(--border)"}}>
            {activeStep>0 && (
              <button className="btn btn-secondary" onClick={()=>setActiveStep(s=>s-1)}>← Back</button>
            )}
            {activeStep<STEPS.length-1 && (
              <button className="btn btn-primary" onClick={goNext}>
                Next: {STEPS[activeStep+1]} →
              </button>
            )}
          </div>
        </main>
      </div>
    </>
  );
}
