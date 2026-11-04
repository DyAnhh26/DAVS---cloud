"""DAVS demo backend: in-memory CSV/XLSX analysis (no database required)."""
from __future__ import annotations

from io import BytesIO, StringIO
import os
import re
from typing import Annotated

import pandas as pd
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse

APP_VERSION = os.getenv("APP_VERSION", "v1").lower()
MAX_UPLOAD_BYTES = 10 * 1024 * 1024
MAX_ROWS = 100_000
ALLOWED_EXTENSIONS = (".csv", ".xlsx")

app = FastAPI(title="DAVS Analytics API", version="1.0.0")


@app.get("/")
def root():
    return {"name": "DAVS Backend", "version": APP_VERSION, "docs": "/docs"}


@app.get("/health")
def health():
    return {"status": "ok", "version": APP_VERSION}


async def read_dataframe(file: UploadFile) -> pd.DataFrame:
    filename = (file.filename or "").lower()
    if not filename.endswith(ALLOWED_EXTENSIONS):
        raise HTTPException(status_code=400, detail="Chỉ hỗ trợ file .csv hoặc .xlsx")

    # Read at most 10 MB + 1 byte, so larger uploads cannot exhaust the app's RAM.
    raw = await file.read(MAX_UPLOAD_BYTES + 1)
    await file.close()
    if not raw:
        raise HTTPException(status_code=400, detail="File đang trống")
    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File vượt quá 10 MB")

    try:
        if filename.endswith(".xlsx"):
            df = pd.read_excel(BytesIO(raw), engine="openpyxl", sheet_name=0)
        else:
            # UTF-8 is the recommended encoding; allow common Vietnamese CSV exports.
            try:
                df = pd.read_csv(BytesIO(raw), encoding="utf-8-sig", sep=None, engine="python")
            except UnicodeDecodeError:
                df = pd.read_csv(BytesIO(raw), encoding="cp1258", sep=None, engine="python")
    except (ValueError, pd.errors.ParserError, ImportError, OSError, UnicodeError) as error:
        raise HTTPException(status_code=400, detail=f"Không thể đọc dữ liệu: {str(error)[:160]}") from error
    except Exception as error:
        raise HTTPException(status_code=400, detail="File dữ liệu không hợp lệ hoặc đã hỏng") from error

    if df.empty or len(df.columns) == 0:
        raise HTTPException(status_code=400, detail="Không tìm thấy dòng dữ liệu nào")
    if len(df) > MAX_ROWS:
        raise HTTPException(status_code=413, detail=f"Dữ liệu vượt quá {MAX_ROWS:,} dòng")
    if len(df.columns) > 100:
        raise HTTPException(status_code=400, detail="Tối đa 100 cột dữ liệu")
    return df


def clean_dataframe(df: pd.DataFrame) -> tuple[pd.DataFrame, int]:
    df = df.copy()
    # Unique, non-blank column names, including files with duplicate Excel headers.
    columns: list[str] = []
    seen: set[str] = set()
    for index, old in enumerate(df.columns, start=1):
        base = re.sub(r"\s+", " ", str(old).strip()) or f"Cot_{index}"
        candidate, suffix = base, 2
        while candidate in seen:
            candidate = f"{base}_{suffix}"
            suffix += 1
        columns.append(candidate)
        seen.add(candidate)
    df.columns = columns

    for column in df.select_dtypes(include=["object", "string"]).columns:
        df[column] = df[column].map(lambda x: x.strip() if isinstance(x, str) else x)
        df[column] = df[column].replace("", pd.NA)
    df = df.dropna(how="all")
    previous = len(df)
    df = df.drop_duplicates().reset_index(drop=True)
    return df, previous - len(df)


def to_json_records(df: pd.DataFrame) -> list[dict]:
    # ISO-style date values and None instead of NaN/NaT for strict JSON.
    safe = df.copy()
    for column in safe.select_dtypes(include=["datetime", "datetimetz"]).columns:
        safe[column] = safe[column].dt.strftime("%Y-%m-%d")
    safe = safe.astype(object).where(pd.notna(safe), None)
    records = safe.to_dict(orient="records")
    # NumPy scalars are usually converted by Pandas; explicitly normalize them.
    result = []
    for row in records:
        result.append({str(key): value.item() if hasattr(value, "item") else value for key, value in row.items()})
    return result


@app.post("/analyze")
async def analyze(
    file: Annotated[UploadFile, File()],
    group_by: Annotated[str | None, Form()] = None,
    measure: Annotated[str | None, Form()] = None,
    aggregation: Annotated[str, Form()] = "mean",
):
    df, removed = clean_dataframe(await read_dataframe(file))
    numeric_cols = list(df.select_dtypes(include="number").columns)
    category_cols = [str(c) for c in df.columns if c not in numeric_cols]
    if not category_cols:
        # All-numeric files can still be grouped by an existing numeric field.
        category_cols = [str(c) for c in df.columns]
    if aggregation not in ("mean", "sum", "count"):
        raise HTTPException(status_code=400, detail="Phép tổng hợp không hợp lệ")
    if group_by is not None and group_by not in df.columns:
        raise HTTPException(status_code=400, detail="Cột phân nhóm không tồn tại")
    if measure is not None and measure not in numeric_cols:
        raise HTTPException(status_code=400, detail="Cột số liệu không tồn tại")

    # Prefer an informative field (e.g. Khoa) over unique row IDs for the first chart.
    practical_categories = [
        col for col in category_cols if 1 < df[col].nunique(dropna=True) <= 12
    ]
    group = group_by or (practical_categories[0] if practical_categories else category_cols[0])
    preferred_metrics = [
        col for col in numeric_cols
        if col.casefold() in ("gpa", "score", "diem", "doanhthu", "sales", "revenue", "amount")
    ]
    metric = measure or ((preferred_metrics or numeric_cols)[0] if numeric_cols else None)
    working = df.copy()
    working[group] = working[group].fillna("(Trống)").astype(str)

    if aggregation == "count" or not metric:
        series = working.groupby(group, dropna=False).size().sort_values(ascending=False)
        metric_label = "Số bản ghi"
    else:
        # Group by chosen category and aggregate the selected numerical measure.
        numeric = pd.to_numeric(working[metric], errors="coerce")
        if metric == group:
            working["_davs_measure"] = numeric
            grouping_measure = "_davs_measure"
        else:
            grouping_measure = metric
        series = working.groupby(group, dropna=False)[grouping_measure].agg(aggregation)
        series = series.sort_values(ascending=False)
        metric_label = f"{('Trung bình' if aggregation == 'mean' else 'Tổng')} {metric}"

    chart_data = [
        {"name": str(label)[:50], "value": round(float(value), 3)}
        for label, value in series.head(12).items()
        if pd.notna(value)
    ]

    summaries = []
    for col in numeric_cols[:12]:
        values = pd.to_numeric(df[col], errors="coerce").dropna()
        if not values.empty:
            summaries.append({
                "column": col, "mean": round(float(values.mean()), 2),
                "min": round(float(values.min()), 2),
                "max": round(float(values.max()), 2),
                "median": round(float(values.median()), 2),
            })

    output = {
        "version": APP_VERSION,
        "file_name": file.filename,
        "row_count": int(len(df)),
        "column_count": int(len(df.columns)),
        "removed_duplicates": removed,
        "null_count": int(df.isna().sum().sum()),
        "columns": [str(c) for c in df.columns],
        "numeric_columns": numeric_cols,
        "category_columns": category_cols,
        "numeric_summary": summaries,
        "preview": to_json_records(df.head(8)),
        "chart": {"group_by": group, "measure": metric, "aggregation": aggregation,
                  "label": metric_label, "data": chart_data},
    }
    # A visible new metric is enabled only by images built with APP_VERSION=v2.
    if APP_VERSION == "v2":
        output["v2_insight"] = {
            "title": "Số cột có dữ liệu số", "value": len(numeric_cols),
            "description": "Chỉ số bổ sung trong bản v2",
        }
    return output


@app.post("/export/csv")
async def export_cleaned_csv(file: Annotated[UploadFile, File()]):
    df, _ = clean_dataframe(await read_dataframe(file))
    # Escape Excel formula-prefixed strings in the exported CSV.
    for column in df.select_dtypes(include=["object", "string"]).columns:
        df[column] = df[column].map(
            lambda x: "'" + x if isinstance(x, str) and x.lstrip().startswith(("=", "+", "-", "@")) else x
        )
    output = StringIO()
    df.to_csv(output, index=False)
    return StreamingResponse(
        iter(["\ufeff" + output.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="davs_cleaned.csv"'},
    )
