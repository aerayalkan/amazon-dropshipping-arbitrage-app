-- Amazon Dropshipping Platform Database Schema
-- PostgreSQL version 14+

-- Kullanıcılar tablosu
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    is_active BOOLEAN DEFAULT true,
    is_verified BOOLEAN DEFAULT false,
    verification_token VARCHAR(255),
    reset_token VARCHAR(255),
    two_factor_enabled BOOLEAN DEFAULT false,
    two_factor_secret VARCHAR(255),
    last_login_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Kullanıcı ayarları
CREATE TABLE user_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amazon_access_key VARCHAR(255),
    amazon_secret_key VARCHAR(255),
    amazon_associate_tag VARCHAR(100),
    amazon_marketplace VARCHAR(50) DEFAULT 'www.amazon.com',
    amazon_seller_id VARCHAR(100),
    amazon_mws_auth_token VARCHAR(255),
    notification_email BOOLEAN DEFAULT true,
    notification_sms BOOLEAN DEFAULT false,
    notification_push BOOLEAN DEFAULT true,
    timezone VARCHAR(50) DEFAULT 'UTC',
    currency VARCHAR(3) DEFAULT 'USD',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Kategoriler
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    amazon_category_id VARCHAR(100),
    parent_id UUID REFERENCES categories(id),
    level INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Ürünler
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    asin VARCHAR(10) NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    brand VARCHAR(255),
    category_id UUID REFERENCES categories(id),
    image_url TEXT,
    product_url TEXT,
    price DECIMAL(10,2),
    prime_eligible BOOLEAN DEFAULT false,
    is_fba BOOLEAN DEFAULT false,
    sales_rank INTEGER,
    review_count INTEGER DEFAULT 0,
    review_average DECIMAL(3,2) DEFAULT 0.00,
    dimensions JSONB,
    weight DECIMAL(8,2),
    features TEXT[],
    variations JSONB,
    is_adult BOOLEAN DEFAULT false,
    is_prime_pantry BOOLEAN DEFAULT false,
    trade_in_eligible BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, asin)
);

-- Ürün fiyat geçmişi
CREATE TABLE product_price_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    price DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    availability VARCHAR(50),
    seller_count INTEGER DEFAULT 0,
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Envanter yönetimi
CREATE TABLE inventory_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    supplier_name VARCHAR(255),
    supplier_url TEXT,
    supplier_product_id VARCHAR(255),
    supplier_price DECIMAL(10,2),
    supplier_currency VARCHAR(3) DEFAULT 'USD',
    minimum_stock INTEGER DEFAULT 0,
    current_stock INTEGER DEFAULT 0,
    reserved_stock INTEGER DEFAULT 0,
    reorder_point INTEGER DEFAULT 0,
    reorder_quantity INTEGER DEFAULT 0,
    last_order_date DATE,
    next_reorder_date DATE,
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Stok hareketleri
CREATE TABLE stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
    movement_type VARCHAR(20) NOT NULL, -- 'in', 'out', 'adjustment'
    quantity INTEGER NOT NULL,
    reason VARCHAR(255),
    reference_id UUID, -- Sipariş ID vs.
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Fiyatlandırma kuralları
CREATE TABLE pricing_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    rule_type VARCHAR(50) NOT NULL, -- 'percentage', 'fixed_amount', 'dynamic'
    markup_percentage DECIMAL(5,2),
    fixed_amount DECIMAL(10,2),
    minimum_profit_percentage DECIMAL(5,2),
    maximum_profit_percentage DECIMAL(5,2),
    consider_amazon_fees BOOLEAN DEFAULT true,
    consider_shipping_costs BOOLEAN DEFAULT true,
    consider_taxes BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Ürün fiyatlandırması
CREATE TABLE product_pricing (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    pricing_rule_id UUID REFERENCES pricing_rules(id),
    supplier_cost DECIMAL(10,2) NOT NULL,
    amazon_fees DECIMAL(10,2) DEFAULT 0,
    shipping_cost DECIMAL(10,2) DEFAULT 0,
    tax_amount DECIMAL(10,2) DEFAULT 0,
    other_costs DECIMAL(10,2) DEFAULT 0,
    total_cost DECIMAL(10,2) NOT NULL,
    selling_price DECIMAL(10,2) NOT NULL,
    profit_amount DECIMAL(10,2) NOT NULL,
    profit_percentage DECIMAL(5,2) NOT NULL,
    roi_percentage DECIMAL(5,2) NOT NULL,
    break_even_quantity INTEGER,
    currency VARCHAR(3) DEFAULT 'USD',
    last_calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Rakip analizi
CREATE TABLE competitors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    seller_name VARCHAR(255) NOT NULL,
    seller_id VARCHAR(100),
    price DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    is_fba BOOLEAN DEFAULT false,
    is_prime BOOLEAN DEFAULT false,
    seller_rating DECIMAL(3,2),
    seller_rating_count INTEGER,
    country VARCHAR(3),
    fulfillment_method VARCHAR(20),
    last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Repricing kuralları
CREATE TABLE repricing_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    strategy VARCHAR(50) NOT NULL, -- 'lowest_price', 'competitive', 'premium'
    minimum_price DECIMAL(10,2),
    maximum_price DECIMAL(10,2),
    target_profit_percentage DECIMAL(5,2),
    price_adjustment_percentage DECIMAL(5,2) DEFAULT 1.00,
    check_frequency_minutes INTEGER DEFAULT 60,
    only_if_buy_box BOOLEAN DEFAULT false,
    avoid_price_war BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true,
    last_run_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Repricing geçmişi
CREATE TABLE repricing_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    repricing_rule_id UUID NOT NULL REFERENCES repricing_rules(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    old_price DECIMAL(10,2) NOT NULL,
    new_price DECIMAL(10,2) NOT NULL,
    reason TEXT,
    competitor_count INTEGER,
    lowest_competitor_price DECIMAL(10,2),
    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Satış tahmini
CREATE TABLE sales_predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    prediction_date DATE NOT NULL,
    predicted_sales INTEGER NOT NULL,
    predicted_revenue DECIMAL(12,2) NOT NULL,
    confidence_score DECIMAL(5,4) NOT NULL,
    model_version VARCHAR(50),
    features_used JSONB,
    actual_sales INTEGER,
    actual_revenue DECIMAL(12,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(product_id, prediction_date)
);

-- Trend analizi
CREATE TABLE trend_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    keyword VARCHAR(255) NOT NULL,
    category_id UUID REFERENCES categories(id),
    google_trends_score INTEGER,
    amazon_search_volume INTEGER,
    trending_direction VARCHAR(10), -- 'up', 'down', 'stable'
    seasonality_score DECIMAL(3,2),
    competition_level VARCHAR(20), -- 'low', 'medium', 'high'
    opportunity_score DECIMAL(5,2),
    analyzed_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(keyword, analyzed_date)
);

-- Sentiment analizi
CREATE TABLE sentiment_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    review_text TEXT NOT NULL,
    review_rating INTEGER,
    sentiment_score DECIMAL(5,4) NOT NULL,
    sentiment_label VARCHAR(20) NOT NULL, -- 'positive', 'negative', 'neutral'
    confidence_score DECIMAL(5,4) NOT NULL,
    keywords JSONB,
    review_source VARCHAR(50) DEFAULT 'amazon',
    review_date DATE,
    analyzed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bildirimler
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- 'stock_low', 'price_change', 'competitor_alert', 'profit_drop'
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    data JSONB,
    is_read BOOLEAN DEFAULT false,
    is_sent BOOLEAN DEFAULT false,
    send_email BOOLEAN DEFAULT false,
    send_sms BOOLEAN DEFAULT false,
    send_push BOOLEAN DEFAULT true,
    priority VARCHAR(20) DEFAULT 'medium', -- 'low', 'medium', 'high', 'urgent'
    scheduled_at TIMESTAMP,
    sent_at TIMESTAMP,
    read_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Dashboard widget ayarları
CREATE TABLE dashboard_widgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    widget_type VARCHAR(50) NOT NULL,
    widget_config JSONB NOT NULL,
    position_x INTEGER DEFAULT 0,
    position_y INTEGER DEFAULT 0,
    width INTEGER DEFAULT 4,
    height INTEGER DEFAULT 4,
    is_visible BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- API istekleri log
CREATE TABLE api_requests_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    status_code INTEGER NOT NULL,
    response_time_ms INTEGER,
    request_size INTEGER,
    response_size INTEGER,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- İndeksler
CREATE INDEX idx_products_user_id ON products(user_id);
CREATE INDEX idx_products_asin ON products(asin);
CREATE INDEX idx_products_category_id ON products(category_id);
CREATE INDEX idx_product_price_history_product_id ON product_price_history(product_id);
CREATE INDEX idx_product_price_history_recorded_at ON product_price_history(recorded_at);
CREATE INDEX idx_inventory_items_user_id ON inventory_items(user_id);
CREATE INDEX idx_inventory_items_product_id ON inventory_items(product_id);
CREATE INDEX idx_competitors_product_id ON competitors(product_id);
CREATE INDEX idx_repricing_rules_user_id ON repricing_rules(user_id);
CREATE INDEX idx_repricing_rules_product_id ON repricing_rules(product_id);
CREATE INDEX idx_sales_predictions_product_id ON sales_predictions(product_id);
CREATE INDEX idx_sales_predictions_prediction_date ON sales_predictions(prediction_date);
CREATE INDEX idx_trend_analysis_keyword ON trend_analysis(keyword);
CREATE INDEX idx_trend_analysis_analyzed_date ON trend_analysis(analyzed_date);
CREATE INDEX idx_sentiment_analysis_product_id ON sentiment_analysis(product_id);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_api_requests_log_user_id ON api_requests_log(user_id);
CREATE INDEX idx_api_requests_log_created_at ON api_requests_log(created_at);

-- Trigger'lar
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_settings_updated_at BEFORE UPDATE ON user_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inventory_items_updated_at BEFORE UPDATE ON inventory_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pricing_rules_updated_at BEFORE UPDATE ON pricing_rules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_product_pricing_updated_at BEFORE UPDATE ON product_pricing
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_repricing_rules_updated_at BEFORE UPDATE ON repricing_rules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dashboard_widgets_updated_at BEFORE UPDATE ON dashboard_widgets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();