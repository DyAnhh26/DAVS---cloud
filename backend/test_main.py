from io import BytesIO
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_health():
    response = client.get('/health')
    assert response.status_code == 200
    assert response.json()['status'] == 'ok'


def test_analyze_csv():
    content = b"Name,Group,Score\nAn,A,8\nBinh,A,9\nChi,B,7\nChi,B,7\n"
    response = client.post('/analyze', files={'file': ('data.csv', BytesIO(content), 'text/csv')})
    assert response.status_code == 200, response.text
    result = response.json()
    assert result['row_count'] == 3
    assert result['removed_duplicates'] == 1
    assert result['numeric_columns'] == ['Score']
    assert result['chart']['data']


def test_invalid_file():
    response = client.post('/analyze', files={'file': ('malware.exe', b'xxx', 'application/octet-stream')})
    assert response.status_code == 400
