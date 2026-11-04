import { useMemo, useRef, useState } from 'react'
import {
  Activity, ArrowRight, BarChart3, CheckCircle2, ChevronDown, CloudUpload,
  Database, Download, FileSpreadsheet, FileText, GitBranch, Layers3,
  LayoutDashboard, RefreshCw, ShieldCheck, Sparkles, Table2, XCircle
} from 'lucide-react'
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, PieChart, Pie,
  Cell, CartesianGrid, XAxis, YAxis, Tooltip
} from 'recharts'

const VERSION = import.meta.env.VITE_APP_VERSION || 'v1'
const PIE_COLORS = ['#5478f3', '#1fb9a4', '#ffb25b', '#aa7bf4', '#f77986', '#37a6e8']
const number = n => typeof n === 'number' ? n.toLocaleString('vi-VN') : '—'

function Sidebar() {
  return <aside className="sidebar">
    <div className="brand"><div className="brand-icon"><Layers3 size={21}/></div><div><strong>DAVS</strong><small>ANALYTICS PLATFORM</small></div></div>
    <div className="workspace-title">WORKSPACE</div>
    <div className="side-item active"><LayoutDashboard size={18}/> Tổng quan <span className="side-dot"/></div>
    <div className="side-item"><Database size={18}/> Nguồn dữ liệu</div>
    <div className="side-item"><BarChart3 size={18}/> Phân tích</div>
    <div className="side-item"><FileText size={18}/> Báo cáo</div>
    <div className="workspace-title second-title">HỆ THỐNG</div>
    <div className="side-item"><ShieldCheck size={18}/> Quyền truy cập</div>
    <div className="side-item"><GitBranch size={18}/> Phiên bản <span className="side-version">{VERSION}</span></div>
    <div className="sidebar-bottom"><div className="avatar">D</div><div><strong>DAVS Demo</strong><small>Developer workspace</small></div><span>•••</span></div>
  </aside>
}

function CardMetric({ icon: Icon, title, value, subtitle, tone = 'blue' }) {
  return <div className="metric-card"><div className={`metric-icon ${tone}`}><Icon size={19}/></div>
    <span className="metric-label">{title}</span><div className="metric-number">{value}</div>
    <div className="metric-subtitle">{subtitle}</div></div>
}

function ChartDisplay({ values, mode }) {
  if (!values?.length) return <div className="empty-chart">Chưa có số liệu để hiển thị biểu đồ.</div>
  if (mode === 'pie') return <ResponsiveContainer width="100%" height={310}>
    <PieChart><Pie data={values} nameKey="name" dataKey="value" cx="50%" cy="50%" outerRadius={115} label={entry => entry.name}>
      {values.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]}/>)}</Pie>
      <Tooltip formatter={n => number(n)} /></PieChart></ResponsiveContainer>
  if (mode === 'line') return <ResponsiveContainer width="100%" height={310}>
    <LineChart data={values} margin={{ top: 15, right: 20, left: 0, bottom: 20 }}>
      <CartesianGrid stroke="#ebedf4" vertical={false}/>
      <XAxis dataKey="name" tick={{fill: '#8792a8', fontSize: 11}} axisLine={false} tickLine={false}/>
      <YAxis tick={{fill: '#8792a8', fontSize: 11}} axisLine={false} tickLine={false}/>
      <Tooltip formatter={n => number(n)} /><Line type="monotone" dataKey="value" stroke="#5578f6" strokeWidth={3} dot={{r: 4}}/>
    </LineChart></ResponsiveContainer>
  return <ResponsiveContainer width="100%" height={310}>
    <BarChart data={values} margin={{ top: 15, right: 18, left: 0, bottom: 20 }}>
      <CartesianGrid stroke="#ebedf4" vertical={false}/>
      <XAxis dataKey="name" tick={{fill: '#8792a8', fontSize: 11}} axisLine={false} tickLine={false}/>
      <YAxis tick={{fill: '#8792a8', fontSize: 11}} axisLine={false} tickLine={false}/>
      <Tooltip formatter={n => number(n)} cursor={{fill: '#f2f5fc'}}/>
      <Bar dataKey="value" fill="#5679f5" radius={[7,7,0,0]} maxBarSize={70}/>
    </BarChart></ResponsiveContainer>
}

export default function App() {
  const inputRef = useRef(null)
  const [file, setFile] = useState(null)
  const [analysis, setAnalysis] = useState(null)
  const [busy, setBusy] = useState(false)
  const [exportBusy, setExportBusy] = useState(false)
  const [error, setError] = useState('')
  const [group, setGroup] = useState('')
  const [measure, setMeasure] = useState('')
  const [aggregation, setAggregation] = useState('mean')
  const [chartMode, setChartMode] = useState('bar')
  const [dragActive, setDragActive] = useState(false)
  const currentCategories = analysis?.category_columns || []
  const currentMeasures = analysis?.numeric_columns || []
  const summary = useMemo(() => analysis?.numeric_summary || [], [analysis])

  async function analyzeFile(selectedFile, selectedGroup = '', selectedMeasure = '', selectedAggregation = 'mean') {
    if (!selectedFile) return
    setBusy(true)
    setError('')
    try {
      const body = new FormData()
      body.append('file', selectedFile)
      if (selectedGroup) body.append('group_by', selectedGroup)
      if (selectedMeasure) body.append('measure', selectedMeasure)
      body.append('aggregation', selectedAggregation)
      const response = await fetch('/api/analyze', { method: 'POST', body })
      const json = await response.json()
      if (!response.ok) throw new Error(json.detail || `Lỗi HTTP ${response.status}`)
      setAnalysis(json)
      setFile(selectedFile)
      setGroup(json.chart.group_by || '')
      setMeasure(json.chart.measure || '')
      setAggregation(json.chart.aggregation)
    } catch (e) {
      setError(e.message || 'Không thể kết nối với Backend. Kiểm tra Backend đang chạy.')
    } finally { setBusy(false) }
  }

  async function exportCsv() {
    if (!file) return
    setExportBusy(true)
    setError('')
    try {
      const body = new FormData()
      body.append('file', file)
      const response = await fetch('/api/export/csv', { method: 'POST', body })
      if (!response.ok) {
        const json = await response.json()
        throw new Error(json.detail || 'Không thể xuất file CSV')
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'davs_cleaned.csv'
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) { setError(e.message) }
    finally { setExportBusy(false) }
  }

  function processFile(selected) {
    if (!selected) return
    if (!/\.(csv|xlsx)$/i.test(selected.name)) {
      setError('Vui lòng chọn file .csv hoặc .xlsx')
      return
    }
    setFile(selected)
    setGroup(''); setMeasure(''); setAggregation('mean')
    analyzeFile(selected)
  }

  return <div className="app"><Sidebar/><main className="main">
    <header className="topbar"><div className="breadcrumb">Workspace <span>/</span> <b>Dashboard</b></div>
      <div className="top-actions"><span className="online"><span/> API-ready design</span><span className="top-avatar">D</span></div></header>
    <div className="page">
      <div className="heading"><div><div className="eyebrow">DATA WORKSPACE / OVERVIEW</div><h1>Phân tích dữ liệu <span>thông minh.</span></h1>
        <p>Từ tệp dữ liệu đến thông tin trực quan — nhanh chóng và dễ dàng.</p></div>
        <div className="version-tag"><CheckCircle2 size={15}/> Build {VERSION}</div></div>
      {VERSION === 'v2' && <div className="release-banner"><Sparkles size={18}/><div><strong>DAVS v2 đang hoạt động</strong><span>Bản cập nhật bổ sung chỉ số phân tích cột số — dùng để demo rolling update & rollback Kubernetes.</span></div></div>}
      <section className="upload-panel"><div className="section-heading"><div><h2>01 <span>Nhập dữ liệu</span></h2><p>Hỗ trợ định dạng CSV và Excel (.xlsx), tối đa 10 MB.</p></div><span className="step-tag">BƯỚC 1/3</span></div>
        <div className={`dropzone ${dragActive ? 'is-dragging' : ''}`} onDragOver={e => { e.preventDefault(); setDragActive(true) }} onDragLeave={() => setDragActive(false)} onDrop={e => { e.preventDefault(); setDragActive(false); processFile(e.dataTransfer.files[0]) }} onClick={() => inputRef.current?.click()} role="button" tabIndex={0} onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}>
          <input ref={inputRef} type="file" accept=".csv,.xlsx" hidden onChange={e => { processFile(e.target.files[0]); e.target.value = '' }}/>
          <div className="upload-symbol"><CloudUpload size={24}/></div><strong>{file ? file.name : 'Kéo thả hoặc nhấn để chọn tệp'}</strong>
          <span>{file ? 'Nhấn để chọn tệp khác' : 'CSV, XLSX · Tệp sẽ được xử lý trong bộ nhớ'}</span><button type="button" className="choose-button" onClick={e => { e.stopPropagation(); inputRef.current?.click() }}><FileSpreadsheet size={16}/> Chọn tệp dữ liệu</button>
        </div>
        {busy && <div className="status-line"><RefreshCw className="spinning" size={17}/> Đang đọc, làm sạch và phân tích dữ liệu…</div>}
        {error && <div className="error"><XCircle size={18}/> {error}</div>}
        {analysis && <div className="upload-success"><CheckCircle2 size={17}/> Đã phân tích <b>{analysis.file_name}</b> thành công · Loại bỏ {analysis.removed_duplicates} dòng trùng lặp</div>}
      </section>
      <section className="results-heading"><div><h2>02 <span>Thống kê tổng quan</span></h2><p>Thông tin được tính trực tiếp từ file đã tải lên.</p></div><span className="step-tag">BƯỚC 2/3</span></section>
      <div className="metric-grid">
        <CardMetric icon={Database} title="Tổng bản ghi" value={analysis ? number(analysis.row_count) : '—'} subtitle="Sau khi loại bỏ trùng lặp"/>
        <CardMetric icon={Table2} title="Số cột" value={analysis ? number(analysis.column_count) : '—'} subtitle="Thuộc tính trong dataset" tone="purple"/>
        <CardMetric icon={Activity} title="Giá trị còn thiếu" value={analysis ? number(analysis.null_count) : '—'} subtitle="Các ô có giá trị null" tone="orange"/>
        {VERSION === 'v2' && <CardMetric icon={Sparkles} title="Số cột dạng số · v2" value={analysis?.v2_insight ? number(analysis.v2_insight.value) : '—'} subtitle="Tính năng mới của bản v2" tone="green"/>}
      </div>
      <section className="visual-heading"><div><h2>03 <span>Dashboard trực quan</span></h2><p>Chọn trường dữ liệu và loại biểu đồ để khám phá.</p></div><span className="step-tag">BƯỚC 3/3</span></section>
      <section className="chart-panel"><div className="chart-head"><div><h3>Phân tích theo nhóm</h3><p>{analysis ? `${analysis.chart.label} · theo ${analysis.chart.group_by}` : 'Biểu đồ sẽ xuất hiện sau khi tải dữ liệu'}</p></div><div className="chart-switch">
        {[['bar', 'Cột'], ['line', 'Đường'], ['pie', 'Tròn']].map(([mode, text]) => <button key={mode} type="button" className={mode === chartMode ? 'selected' : ''} onClick={() => setChartMode(mode)}>{text}</button>)}
      </div></div>
      {analysis && <div className="filters">
        <label>Phân nhóm <span className="select-wrap"><select value={group} onChange={e => setGroup(e.target.value)}>{currentCategories.map(c => <option value={c} key={c}>{c}</option>)}</select><ChevronDown size={14}/></span></label>
        <label>Chỉ số <span className="select-wrap"><select value={measure} onChange={e => setMeasure(e.target.value)}>{!currentMeasures.length && <option value="">Số bản ghi</option>}{currentMeasures.map(c => <option value={c} key={c}>{c}</option>)}</select><ChevronDown size={14}/></span></label>
        <label>Tổng hợp <span className="select-wrap"><select value={aggregation} onChange={e => setAggregation(e.target.value)}><option value="mean">Trung bình</option><option value="sum">Tổng</option><option value="count">Đếm</option></select><ChevronDown size={14}/></span></label>
        <button className="apply-btn" disabled={busy} onClick={() => analyzeFile(file, group, measure, aggregation)}><RefreshCw size={15}/> Áp dụng</button>
      </div>}
      <div className="chart-content">{analysis ? <ChartDisplay values={analysis.chart.data} mode={chartMode}/> : <div className="chart-placeholder"><BarChart3 size={42}/><strong>Chưa có dữ liệu trực quan</strong><span>Tải lên tệp students.csv trong thư mục sample_data để xem thử.</span></div>}</div>
      </section>
      {analysis && <section className="details-grid"><div className="table-panel"><div className="panel-title"><div><h3><Table2 size={17}/> Xem trước dữ liệu</h3><p>Hiển thị tối đa 8 dòng đầu tiên sau khi làm sạch.</p></div><button className="export-btn" onClick={exportCsv} disabled={exportBusy}><Download size={16}/>{exportBusy ? 'Đang xuất…' : 'Tải CSV đã làm sạch'}</button></div>
        <div className="table-scroll"><table><thead><tr>{analysis.columns.map(c => <th key={c}>{c}</th>)}</tr></thead><tbody>{analysis.preview.map((row,i) => <tr key={i}>{analysis.columns.map(col => <td key={col}>{row[col] == null ? '—' : String(row[col])}</td>)}</tr>)}</tbody></table></div></div>
        <div className="summary-panel"><div className="panel-title"><div><h3><Activity size={17}/> Thống kê số</h3><p>Trung bình, min, max, trung vị.</p></div></div>{summary.length ? summary.slice(0, 5).map(item => <div className="summary-item" key={item.column}><strong>{item.column}</strong><span>TB: {number(item.mean)} · Min: {number(item.min)} · Max: {number(item.max)}</span></div>) : <p>Không phát hiện cột dữ liệu dạng số.</p>}</div>
      </section>}
      <footer><span>© 2026 DAVS · Cloud Computing Project</span><span>React + FastAPI + Docker <ArrowRight size={14}/></span></footer>
    </div>
  </main></div>
}
