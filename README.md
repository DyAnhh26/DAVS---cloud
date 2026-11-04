# DAVS – Thành viên 1: Dev & Package

Dự án mẫu **Hệ thống Phân tích và Trực quan hóa Dữ liệu (DAVS)** để thực hành Cloud Computing. Có Frontend React + Vite, Backend FastAPI + Pandas, Dockerfiles riêng, Compose và script build/push lên Docker Hub.

## 1. Chạy nhanh bằng Docker (khuyến nghị)

**Yêu cầu:** Docker Desktop đang chạy.

```bash
cd davs-member1
docker compose up --build -d
docker compose ps
```

Mở http://localhost:8080 (Frontend) và http://localhost:8000/docs (Backend API). Upload `sample_data/students.csv` trên website.

Thử trực tiếp API:

```bash
curl http://localhost:8000/health
curl -X POST -F "file=@sample_data/students.csv" http://localhost:8080/api/analyze
bash scripts/check-local.sh
```

Dừng: `docker compose down`. Xem log: `docker compose logs -f backend` hoặc `docker compose logs -f frontend`.

## 2. Chạy bằng VS Code (không cần Docker)

Terminal thứ nhất:

```bash
cd davs-member1/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Terminal thứ hai:

```bash
cd davs-member1/frontend
npm install
npm run dev
```

Truy cập http://localhost:5173 (Vite proxy `/api` về FastAPI `localhost:8000`). Có thể thực hiện với Python 3.12 (Docker dùng Python 3.12).

## 3. Build và push 2 phiên bản lên Docker Hub

Đăng nhập Docker Hub trước:

```bash
docker login
```

Chọn tên Docker Hub chính xác của bạn thay cho `yourdockerhub`:

```bash
DOCKERHUB_USER=yourdockerhub bash scripts/build-push.sh v1
DOCKERHUB_USER=yourdockerhub bash scripts/build-push.sh v2
```

Mỗi lệnh build/push **2 image** (frontend/backend). Kết quả 4 tag:

- `yourdockerhub/davs-frontend:v1`
- `yourdockerhub/davs-backend:v1`
- `yourdockerhub/davs-frontend:v2`
- `yourdockerhub/davs-backend:v2`

Images **multi-architecture** `linux/amd64,linux/arm64`, thích hợp Mac M2 và VM x86_64. Cả hai phiên bản lấy cùng code base nhưng build với tham số `APP_VERSION`: bản `v2` có thêm chỉ số phân tích và banner mới để phục vụ demo update/rollback. Đây là một tính năng nhỏ có chủ đích cho bài thực hành triển khai, không phải hai ứng dụng độc lập.

Kiểm tra image từ Registry:

```bash
docker buildx imagetools inspect yourdockerhub/davs-frontend:v1
docker buildx imagetools inspect yourdockerhub/davs-backend:v2
```

**Lưu ý:** buildx `--push` trực tiếp lên Docker Hub; không nhất thiết xuất hiện trong `docker images` local. Để test image đã push: `docker pull yourdockerhub/davs-backend:v1`.

Để xem v2 trên máy local sau khi build từ source:

```bash
APP_VERSION=v2 docker compose up --build -d
```

Quay về v1:

```bash
APP_VERSION=v1 docker compose up --build -d
```

## 4. Chức năng DAVS MVP

- Người dùng chọn CSV hoặc XLSX (tối đa 10 MB, 100.000 dòng / 100 cột).
- Backend kiểm tra định dạng, làm sạch tên cột, bỏ dòng trống, bỏ dòng trùng, xử lý ô trống.
- Trả về số dòng, số cột, số ô trống, thống kê số và 8 dòng xem trước.
- Chọn trường phân nhóm, trường số và cách tổng hợp (trung bình, tổng, đếm).
- Xem biểu đồ cột, đường, tròn; tải file CSV đã làm sạch.
- v2 bổ sung số cột dữ liệu dạng số trên giao diện (dùng để demo cập nhật image).
- `/health` backend, `/healthz` frontend hỗ trợ probe Kubernetes.

**Giới hạn MVP:** không lưu file vào DB, không có đăng nhập/phân quyền, không hỗ trợ `.twb` Tableau, không có dashboard builder kéo-thả, không có xử lý dữ liệu phân tán. Đây chỉ là tập con có thể demo của SRS lớn (7 phân hệ/26 use case), không tuyên bố hiện thực toàn bộ SRS. Endpoint minh họa, chưa phải sản phẩm production-ready.

## 5. Handoff cho thành viên 3 (Kubernetes)

Xem file [`K8S_HANDOFF.md`](K8S_HANDOFF.md). Quan trọng:

- Backend container port **8000**, health **GET /health**.
- Frontend container port **80**, health **GET /healthz**.
- **Bắt buộc** có Kubernetes Service tên `davs-backend` trong **cùng namespace** với frontend. Nginx frontend chuyển `/api/*` sang `http://davs-backend:8000/*`. Tạo Backend Service trước khi khởi chạy pod frontend.
- Namespace/Deployment/Service/NodePort/Ingress do **thành viên 3** phụ trách.
- Image `v1` và `v2` là những tag độc lập trên Docker Hub. Hãy gửi tên registry chính xác cho thành viên 3.

## 6. Git branches và pull request

Repo GitHub **không chọn tạo README, .gitignore, license** khi tạo lần đầu (vì local đã có). Chạy các bước chi tiết trong [`GIT_WORKFLOW.md`](GIT_WORKFLOW.md).

Mỗi thành viên tạo branch riêng, push commit thật, mở Pull Request, người khác review và merge vào `main`. Không commit tài khoản, mật khẩu, token, `.env` hoặc file lớn.

## 7. Unit test Backend (tùy chọn)

```bash
cd backend
python3 -m pip install -r requirements-dev.txt
python3 -m pytest -q
```
