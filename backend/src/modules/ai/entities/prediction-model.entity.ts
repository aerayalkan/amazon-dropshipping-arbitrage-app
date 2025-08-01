import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum ModelType {
  LSTM = 'lstm',
  PROPHET = 'prophet',
  ARIMA = 'arima',
  LINEAR_REGRESSION = 'linear_regression',
  RANDOM_FOREST = 'random_forest',
  NEURAL_NETWORK = 'neural_network',
  TRANSFORMER = 'transformer',
  CUSTOM = 'custom',
}

export enum ModelStatus {
  TRAINING = 'training',
  TRAINED = 'trained',
  DEPLOYED = 'deployed',
  FAILED = 'failed',
  DEPRECATED = 'deprecated',
  TESTING = 'testing',
}

export enum PredictionType {
  SALES_FORECAST = 'sales_forecast',
  PRICE_PREDICTION = 'price_prediction',
  DEMAND_FORECAST = 'demand_forecast',
  TREND_ANALYSIS = 'trend_analysis',
  SEASONALITY = 'seasonality',
  MARKET_VOLATILITY = 'market_volatility',
  COMPETITOR_BEHAVIOR = 'competitor_behavior',
  INVENTORY_OPTIMIZATION = 'inventory_optimization',
}

@Entity('prediction_models')
@Index(['userId', 'modelType'])
@Index(['predictionType', 'modelStatus'])
@Index(['accuracy', 'modelStatus'])
@Index(['lastTrainedAt'])
export class PredictionModel {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'model_name' })
  modelName: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({
    type: 'enum',
    enum: ModelType,
    name: 'model_type',
  })
  modelType: ModelType;

  @Column({
    type: 'enum',
    enum: PredictionType,
    name: 'prediction_type',
  })
  predictionType: PredictionType;

  @Column({
    type: 'enum',
    enum: ModelStatus,
    name: 'model_status',
    default: ModelStatus.TRAINING,
  })
  modelStatus: ModelStatus;

  // Model Configuration
  @Column({ type: 'json' })
  modelConfig: {
    hyperparameters: {
      learningRate?: number;
      epochs?: number;
      batchSize?: number;
      hiddenLayers?: number[];
      dropoutRate?: number;
      regularization?: number;
      optimizer?: string;
      lossFunction?: string;
    };
    features: {
      inputFeatures: string[];
      targetVariable: string;
      timeSeriesLength?: number;
      featureEngineering?: {
        normalization: boolean;
        encoding: string[];
        aggregations?: string[];
      };
    };
    validation: {
      trainSplit: number;
      validationSplit: number;
      testSplit: number;
      crossValidation?: {
        folds: number;
        strategy: string;
      };
    };
  };

  // Model Performance Metrics
  @Column({ name: 'accuracy', type: 'decimal', precision: 8, scale: 4, nullable: true })
  accuracy?: number;

  @Column({ name: 'mae', type: 'decimal', precision: 12, scale: 6, nullable: true })
  mae?: number; // Mean Absolute Error

  @Column({ name: 'rmse', type: 'decimal', precision: 12, scale: 6, nullable: true })
  rmse?: number; // Root Mean Square Error

  @Column({ name: 'mape', type: 'decimal', precision: 8, scale: 4, nullable: true })
  mape?: number; // Mean Absolute Percentage Error

  @Column({ name: 'r_squared', type: 'decimal', precision: 8, scale: 4, nullable: true })
  rSquared?: number;

  @Column({ type: 'json', nullable: true })
  performanceMetrics?: {
    precision?: number;
    recall?: number;
    f1Score?: number;
    auc?: number;
    confusionMatrix?: number[][];
    classificationReport?: any;
    validationLoss?: number;
    trainingLoss?: number;
    overfit?: boolean;
    convergence?: boolean;
    learningCurve?: Array<{
      epoch: number;
      trainLoss: number;
      valLoss: number;
      accuracy: number;
    }>;
  };

  // Training Information
  @Column({ name: 'training_data_size', nullable: true })
  trainingDataSize?: number;

  @Column({ name: 'training_duration_ms', nullable: true })
  trainingDurationMs?: number;

  @Column({ name: 'last_trained_at', type: 'timestamp', nullable: true })
  lastTrainedAt?: Date;

  @Column({ name: 'next_retrain_at', type: 'timestamp', nullable: true })
  nextRetrainAt?: Date;

  @Column({ name: 'auto_retrain', default: true })
  autoRetrain: boolean;

  @Column({ name: 'retrain_frequency_days', default: 30 })
  retrainFrequencyDays: number;

  // Model File Information
  @Column({ name: 'model_file_path', nullable: true })
  modelFilePath?: string;

  @Column({ name: 'model_file_size', nullable: true })
  modelFileSize?: number;

  @Column({ name: 'model_version', default: '1.0.0' })
  modelVersion: string;

  @Column({ name: 'framework', nullable: true })
  framework?: string; // 'tensorflow', 'pytorch', 'scikit-learn', etc.

  // Feature Importance
  @Column({ type: 'json', nullable: true })
  featureImportance?: Array<{
    feature: string;
    importance: number;
    rank: number;
  }>;

  // Prediction History Summary
  @Column({ type: 'json', nullable: true })
  predictionHistory?: {
    totalPredictions: number;
    correctPredictions: number;
    avgConfidence: number;
    recentAccuracy: number;
    monthlyStats: Array<{
      month: string;
      predictions: number;
      accuracy: number;
    }>;
  };

  // Business Impact Metrics
  @Column({ type: 'json', nullable: true })
  businessImpact?: {
    revenueImpact?: number;
    costSavings?: number;
    efficiencyGain?: number;
    riskReduction?: number;
    decisionSupport?: {
      automatedDecisions: number;
      manualOverrides: number;
      successfulRecommendations: number;
    };
  };

  // Monitoring and Alerts
  @Column({ type: 'json', nullable: true })
  monitoringConfig?: {
    accuracyThreshold: number;
    driftDetection: {
      enabled: boolean;
      threshold: number;
      windowSize: number;
    };
    performanceDegradation: {
      enabled: boolean;
      threshold: number;
    };
    alerts: Array<{
      type: 'accuracy_drop' | 'data_drift' | 'prediction_anomaly';
      threshold: number;
      recipients: string[];
    }>;
  };

  // A/B Testing
  @Column({ type: 'json', nullable: true })
  abTestConfig?: {
    isControlGroup: boolean;
    testName: string;
    trafficSplit: number; // percentage
    startDate: Date;
    endDate?: Date;
    metrics: string[];
    champion?: boolean;
  };

  // Error Tracking
  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError?: string;

  @Column({ name: 'error_count', default: 0 })
  errorCount: number;

  @Column({ name: 'last_error_at', type: 'timestamp', nullable: true })
  lastErrorAt?: Date;

  // Usage Statistics
  @Column({ name: 'prediction_count', default: 0 })
  predictionCount: number;

  @Column({ name: 'last_prediction_at', type: 'timestamp', nullable: true })
  lastPredictionAt?: Date;

  @Column({ name: 'avg_prediction_time_ms', nullable: true })
  avgPredictionTimeMs?: number;

  @Column({ type: 'json', nullable: true })
  tags?: string[];

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Business Logic Methods
  isHealthy(): boolean {
    return (
      this.modelStatus === ModelStatus.DEPLOYED &&
      this.errorCount < 10 &&
      (!this.accuracy || this.accuracy > 0.7) &&
      (!this.lastErrorAt || Date.now() - this.lastErrorAt.getTime() > 24 * 60 * 60 * 1000)
    );
  }

  needsRetraining(): boolean {
    if (!this.autoRetrain || !this.lastTrainedAt) return false;
    
    const daysSinceTraining = (Date.now() - this.lastTrainedAt.getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceTraining >= this.retrainFrequencyDays;
  }

  getPerformanceGrade(): 'A' | 'B' | 'C' | 'D' | 'F' {
    if (!this.accuracy) return 'F';
    
    if (this.accuracy >= 0.9) return 'A';
    if (this.accuracy >= 0.8) return 'B';
    if (this.accuracy >= 0.7) return 'C';
    if (this.accuracy >= 0.6) return 'D';
    return 'F';
  }

  calculateROI(): number {
    if (!this.businessImpact?.revenueImpact && !this.businessImpact?.costSavings) return 0;
    
    const benefits = (this.businessImpact.revenueImpact || 0) + (this.businessImpact.costSavings || 0);
    const costs = this.trainingDurationMs ? this.trainingDurationMs * 0.001 : 100; // Simplified cost calculation
    
    return (benefits - costs) / costs * 100;
  }

  getPredictionReliability(): number {
    let reliability = 50; // Base score

    // Accuracy factor (40% weight)
    if (this.accuracy) {
      reliability += (this.accuracy - 0.5) * 80; // Scale 0.5-1.0 to 0-40
    }

    // Stability factor (30% weight)
    const errorRate = this.predictionCount > 0 ? this.errorCount / this.predictionCount : 0;
    reliability += (1 - errorRate) * 30;

    // Freshness factor (20% weight)
    if (this.lastTrainedAt) {
      const daysSinceTraining = (Date.now() - this.lastTrainedAt.getTime()) / (1000 * 60 * 60 * 24);
      const freshness = Math.max(0, 1 - daysSinceTraining / 90); // Degrade over 90 days
      reliability += freshness * 20;
    }

    // Volume factor (10% weight)
    if (this.predictionCount > 100) {
      reliability += 10;
    } else if (this.predictionCount > 10) {
      reliability += 5;
    }

    return Math.max(0, Math.min(100, reliability));
  }

  generateInsights(): string[] {
    const insights: string[] = [];

    if (this.getPerformanceGrade() === 'A') {
      insights.push('Model is performing excellently with high accuracy');
    } else if (this.getPerformanceGrade() === 'F') {
      insights.push('Model performance is poor and may need complete retraining');
    }

    if (this.needsRetraining()) {
      insights.push(`Model needs retraining - ${Math.floor((Date.now() - this.lastTrainedAt!.getTime()) / (1000 * 60 * 60 * 24))} days since last training`);
    }

    if (this.errorCount > 5) {
      insights.push(`High error rate detected - ${this.errorCount} errors recorded`);
    }

    if (this.performanceMetrics?.overfit) {
      insights.push('Model shows signs of overfitting - consider regularization');
    }

    if (this.businessImpact && this.calculateROI() > 200) {
      insights.push(`High ROI model - generating ${this.calculateROI().toFixed(0)}% return on investment`);
    }

    return insights;
  }

  // Static factory methods
  static createLSTMModel(data: {
    userId: string;
    name: string;
    predictionType: PredictionType;
    features: string[];
    targetVariable: string;
    timeSeriesLength: number;
  }): Partial<PredictionModel> {
    return {
      userId: data.userId,
      modelName: data.name,
      modelType: ModelType.LSTM,
      predictionType: data.predictionType,
      modelStatus: ModelStatus.TRAINING,
      modelConfig: {
        hyperparameters: {
          learningRate: 0.001,
          epochs: 100,
          batchSize: 32,
          hiddenLayers: [50, 25],
          dropoutRate: 0.2,
          optimizer: 'adam',
          lossFunction: 'mse',
        },
        features: {
          inputFeatures: data.features,
          targetVariable: data.targetVariable,
          timeSeriesLength: data.timeSeriesLength,
          featureEngineering: {
            normalization: true,
            encoding: ['categorical'],
          },
        },
        validation: {
          trainSplit: 0.7,
          validationSplit: 0.15,
          testSplit: 0.15,
        },
      },
      framework: 'tensorflow',
      modelVersion: '1.0.0',
      autoRetrain: true,
      retrainFrequencyDays: 30,
    };
  }

  static createProphetModel(data: {
    userId: string;
    name: string;
    targetVariable: string;
    seasonality: 'daily' | 'weekly' | 'monthly' | 'yearly';
  }): Partial<PredictionModel> {
    return {
      userId: data.userId,
      modelName: data.name,
      modelType: ModelType.PROPHET,
      predictionType: PredictionType.SALES_FORECAST,
      modelStatus: ModelStatus.TRAINING,
      modelConfig: {
        hyperparameters: {
          // Prophet-specific parameters
        },
        features: {
          inputFeatures: ['ds', data.targetVariable], // Prophet uses 'ds' for timestamps
          targetVariable: data.targetVariable,
          featureEngineering: {
            normalization: false, // Prophet handles this internally
            encoding: [],
          },
        },
        validation: {
          trainSplit: 0.8,
          validationSplit: 0.0,
          testSplit: 0.2,
        },
      },
      framework: 'prophet',
      modelVersion: '1.0.0',
      autoRetrain: true,
      retrainFrequencyDays: 7, // More frequent for time series
    };
  }

  static createSentimentModel(data: {
    userId: string;
    name: string;
    modelType: ModelType.TRANSFORMER;
    pretrainedModel: string;
  }): Partial<PredictionModel> {
    return {
      userId: data.userId,
      modelName: data.name,
      modelType: data.modelType,
      predictionType: PredictionType.TREND_ANALYSIS,
      modelStatus: ModelStatus.TRAINING,
      modelConfig: {
        hyperparameters: {
          learningRate: 2e-5,
          epochs: 3,
          batchSize: 16,
        },
        features: {
          inputFeatures: ['text', 'rating', 'verified_purchase'],
          targetVariable: 'sentiment',
          featureEngineering: {
            normalization: false,
            encoding: ['text_tokenization'],
          },
        },
        validation: {
          trainSplit: 0.8,
          validationSplit: 0.1,
          testSplit: 0.1,
        },
      },
      framework: 'transformers',
      modelVersion: '1.0.0',
      autoRetrain: false, // Sentiment models usually don't need frequent retraining
      retrainFrequencyDays: 90,
    };
  }
}