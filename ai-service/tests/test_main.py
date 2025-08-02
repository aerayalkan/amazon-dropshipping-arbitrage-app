"""
Tests for the main AI service application
"""

import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_root_endpoint():
    """Test the root endpoint"""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["message"] == "Amazon Dropshipping AI Service"
    assert data["version"] == "1.0.0"
    assert data["status"] == "running"
    assert "timestamp" in data

def test_health_check():
    """Test the health check endpoint"""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "ai-service"
    assert data["version"] == "1.0.0"
    assert "timestamp" in data

def test_metrics_endpoint():
    """Test the metrics endpoint"""
    response = client.get("/metrics")
    assert response.status_code == 200
    data = response.json()
    assert "uptime" in data
    assert "requests_total" in data
    assert "timestamp" in data

def test_trend_prediction():
    """Test the trend prediction endpoint"""
    test_data = {
        "asin": "B08N5WRWNW",
        "historical_data": [1.0, 1.1, 1.05, 1.2]
    }
    response = client.post("/ai/trend-prediction", json=test_data)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "prediction" in data
    assert "timestamp" in data

def test_sentiment_analysis():
    """Test the sentiment analysis endpoint"""
    test_data = {
        "asin": "B08N5WRWNW",
        "reviews": ["Great product!", "Love it!", "Highly recommend"]
    }
    response = client.post("/ai/sentiment-analysis", json=test_data)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "sentiment" in data
    assert "timestamp" in data

def test_sales_forecast():
    """Test the sales forecast endpoint"""
    test_data = {
        "asin": "B08N5WRWNW",
        "historical_sales": [100, 110, 105, 120, 115]
    }
    response = client.post("/ai/sales-forecast", json=test_data)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "forecast" in data
    assert "timestamp" in data