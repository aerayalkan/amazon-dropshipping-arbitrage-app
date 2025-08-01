import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  JoinColumn,
} from 'typeorm';

import { PredictionModel } from './prediction-model.entity';

export enum DataType {
  NUMERICAL = 'numerical',
  CATEGORICAL = 'categorical',
  TEXT = 'text',
  TIME_SERIES = 'time_series',
  IMAGE = 'image',
  MIXED = 'mixed',
}

export enum DataSource {
  AMAZON_API = 'amazon_api',
  WEB_SCRAPING = 'web_scraping',
  USER_INPUT = 'user_input',
  DATABASE = 'database',
  FILE_UPLOAD = 'file_upload',
  EXTERNAL_API = 'external_api',
  SYNTHETIC = 'synthetic',
}

export enum DataQuality {
  EXCELLENT = 'excellent', // >95%
  GOOD = 'good', // 85-95%
  FAIR = 'fair', // 70-85%
  POOR = 'poor', // 50-70%
  UNUSABLE = 'unusable', // <50%
}

export enum ProcessingStatus {
  RAW = 'raw',
  PROCESSING = 'processing',
  PROCESSED = 'processed',
  VALIDATED = 'validated',
  AUGMENTED = 'augmented',
  FAILED = 'failed',
  ARCHIVED = 'archived',
}

@Entity('ai_training_data')
@Index(['userId', 'dataType'])
@Index(['modelId', 'processingStatus'])
@Index(['dataSource', 'collectedAt'])
@Index(['dataQuality', 'isActive'])
export class AITrainingData {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'model_id', nullable: true })
  modelId?: string;

  @ManyToOne(() => PredictionModel, { nullable: true })
  @JoinColumn({ name: 'model_id' })
  model?: PredictionModel;

  @Column({ name: 'dataset_name' })
  datasetName: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({
    type: 'enum',
    enum: DataType,
    name: 'data_type',
  })
  dataType: DataType;

  @Column({
    type: 'enum',
    enum: DataSource,
    name: 'data_source',
  })
  dataSource: DataSource;

  @Column({
    type: 'enum',
    enum: ProcessingStatus,
    name: 'processing_status',
    default: ProcessingStatus.RAW,
  })
  processingStatus: ProcessingStatus;

  @Column({
    type: 'enum',
    enum: DataQuality,
    name: 'data_quality',
    nullable: true,
  })
  dataQuality?: DataQuality;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  // Data Metadata
  @Column({ name: 'record_count', default: 0 })
  recordCount: number;

  @Column({ name: 'feature_count', default: 0 })
  featureCount: number;

  @Column({ name: 'file_size_bytes', nullable: true })
  fileSizeBytes?: number;

  @Column({ name: 'file_path', nullable: true })
  filePath?: string;

  @Column({ name: 'file_format', nullable: true })
  fileFormat?: string; // 'csv', 'json', 'parquet', etc.

  @Column({ name: 'compression_type', nullable: true })
  compressionType?: string;

  // Schema Definition
  @Column({ type: 'json' })
  schema: {
    features: Array<{
      name: string;
      type: 'numeric' | 'categorical' | 'text' | 'datetime' | 'boolean';
      description?: string;
      required: boolean;
      defaultValue?: any;
      constraints?: {
        min?: number;
        max?: number;
        options?: string[];
        pattern?: string;
        maxLength?: number;
      };
    }>;
    target?: {
      name: string;
      type: 'numeric' | 'categorical' | 'binary';
      description?: string;
    };
    indexes?: string[];
    primaryKey?: string;
  };

  // Data Quality Metrics
  @Column({ type: 'json', nullable: true })
  qualityMetrics?: {
    completeness: number; // 0-100, percentage of non-null values
    accuracy: number; // 0-100, estimated accuracy
    consistency: number; // 0-100, data consistency score
    validity: number; // 0-100, data format validity
    uniqueness: number; // 0-100, uniqueness ratio
    timeliness: number; // 0-100, data freshness score
    missingValues: {
      total: number;
      percentage: number;
      byFeature: Array<{
        feature: string;
        missing: number;
        percentage: number;
      }>;
    };
    outliers: {
      total: number;
      percentage: number;
      byFeature: Array<{
        feature: string;
        outliers: number;
        method: string;
      }>;
    };
    duplicates: {
      total: number;
      percentage: number;
      strategy: 'keep_first' | 'keep_last' | 'remove_all';
    };
  };

  // Statistical Summary
  @Column({ type: 'json', nullable: true })
  statisticalSummary?: {
    numerical: Array<{
      feature: string;
      count: number;
      mean: number;
      std: number;
      min: number;
      max: number;
      percentiles: {
        p25: number;
        p50: number;
        p75: number;
      };
      skewness: number;
      kurtosis: number;
    }>;
    categorical: Array<{
      feature: string;
      uniqueValues: number;
      mostFrequent: string;
      mostFrequentCount: number;
      distribution: Array<{
        value: string;
        count: number;
        percentage: number;
      }>;
    }>;
    correlations?: Array<{
      feature1: string;
      feature2: string;
      correlation: number;
      significance: number;
    }>;
  };

  // Processing History
  @Column({ type: 'json', nullable: true })
  processingHistory?: Array<{
    timestamp: Date;
    operation: string;
    parameters: any;
    recordsBefore: number;
    recordsAfter: number;
    processingTime: number;
    success: boolean;
    error?: string;
  }>;

  // Data Transformations Applied
  @Column({ type: 'json', nullable: true })
  transformations?: {
    cleaning: Array<{
      type: 'remove_duplicates' | 'handle_missing' | 'outlier_removal' | 'format_correction';
      parameters: any;
      applied: boolean;
      timestamp: Date;
    }>;
    featureEngineering: Array<{
      type: 'scaling' | 'encoding' | 'binning' | 'polynomial' | 'interaction' | 'selection';
      parameters: any;
      newFeatures?: string[];
      applied: boolean;
      timestamp: Date;
    }>;
    augmentation: Array<{
      type: 'synthetic_generation' | 'oversampling' | 'undersampling' | 'noise_injection';
      parameters: any;
      recordsGenerated?: number;
      applied: boolean;
      timestamp: Date;
    }>;
  };

  // Sampling Information
  @Column({ type: 'json', nullable: true })
  sampling?: {
    strategy: 'random' | 'stratified' | 'systematic' | 'cluster';
    sampleSize: number;
    originalSize: number;
    samplingRatio: number;
    stratificationColumn?: string;
    randomSeed?: number;
    representativeness: number; // 0-100
  };

  // Data Splits
  @Column({ type: 'json', nullable: true })
  dataSplits?: {
    train: {
      recordCount: number;
      percentage: number;
      startDate?: Date;
      endDate?: Date;
    };
    validation: {
      recordCount: number;
      percentage: number;
      startDate?: Date;
      endDate?: Date;
    };
    test: {
      recordCount: number;
      percentage: number;
      startDate?: Date;
      endDate?: Date;
    };
    splitStrategy: 'random' | 'temporal' | 'stratified';
    splitSeed?: number;
  };

  // Version Control
  @Column({ name: 'version', default: '1.0.0' })
  version: string;

  @Column({ name: 'parent_dataset_id', nullable: true })
  parentDatasetId?: string;

  @Column({ type: 'json', nullable: true })
  versionHistory?: Array<{
    version: string;
    changes: string[];
    timestamp: Date;
    createdBy: string;
  }>;

  // Collection Information
  @Column({ name: 'collected_at', type: 'timestamp' })
  collectedAt: Date;

  @Column({ name: 'collection_period_start', type: 'timestamp', nullable: true })
  collectionPeriodStart?: Date;

  @Column({ name: 'collection_period_end', type: 'timestamp', nullable: true })
  collectionPeriodEnd?: Date;

  @Column({ name: 'collection_frequency', nullable: true })
  collectionFrequency?: string; // 'daily', 'weekly', 'monthly', 'on_demand'

  // Usage Tracking
  @Column({ name: 'usage_count', default: 0 })
  usageCount: number;

  @Column({ name: 'last_used_at', type: 'timestamp', nullable: true })
  lastUsedAt?: Date;

  @Column({ name: 'models_trained', default: 0 })
  modelsTrained: number;

  // Validation Results
  @Column({ type: 'json', nullable: true })
  validationResults?: {
    businessRules: Array<{
      rule: string;
      passed: boolean;
      details: string;
    }>;
    statisticalTests: Array<{
      test: string;
      statistic: number;
      pValue: number;
      passed: boolean;
    }>;
    crossValidation?: {
      folds: number;
      averageScore: number;
      standardDeviation: number;
      scores: number[];
    };
  };

  // Security and Privacy
  @Column({ type: 'json', nullable: true })
  privacySettings?: {
    containsPII: boolean;
    anonymized: boolean;
    encryptionApplied: boolean;
    retentionPeriod?: number; // days
    accessRestrictions: string[];
    complianceFlags: string[]; // 'GDPR', 'CCPA', etc.
  };

  // Performance Metrics
  @Column({ name: 'processing_time_ms', nullable: true })
  processingTimeMs?: number;

  @Column({ name: 'last_processed_at', type: 'timestamp', nullable: true })
  lastProcessedAt?: Date;

  @Column({ name: 'checksum', nullable: true })
  checksum?: string; // For data integrity verification

  // External References
  @Column({ type: 'json', nullable: true })
  externalReferences?: {
    sourceUrls?: string[];
    apiEndpoints?: string[];
    documentIds?: string[];
    relatedDatasets?: string[];
  };

  @Column({ type: 'json', nullable: true })
  tags?: string[];

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Business Logic Methods
  isHighQuality(): boolean {
    return this.dataQuality === DataQuality.EXCELLENT || this.dataQuality === DataQuality.GOOD;
  }

  isReady(): boolean {
    return this.processingStatus === ProcessingStatus.PROCESSED || 
           this.processingStatus === ProcessingStatus.VALIDATED;
  }

  needsProcessing(): boolean {
    return this.processingStatus === ProcessingStatus.RAW ||
           this.processingStatus === ProcessingStatus.FAILED;
  }

  getCompletenessScore(): number {
    return this.qualityMetrics?.completeness || 0;
  }

  getMissingValuePercentage(): number {
    return this.qualityMetrics?.missingValues.percentage || 0;
  }

  getOutlierPercentage(): number {
    return this.qualityMetrics?.outliers.percentage || 0;
  }

  hasTarget(): boolean {
    return this.schema.target !== undefined;
  }

  isTimeSeriesData(): boolean {
    return this.dataType === DataType.TIME_SERIES ||
           this.schema.features.some(f => f.type === 'datetime');
  }

  getDataFreshness(): number {
    if (!this.collectedAt) return 0;
    
    const hoursSinceCollection = (Date.now() - this.collectedAt.getTime()) / (1000 * 60 * 60);
    
    // Fresher data gets higher score
    if (hoursSinceCollection <= 24) return 100;
    if (hoursSinceCollection <= 168) return 80; // 1 week
    if (hoursSinceCollection <= 720) return 60; // 1 month
    if (hoursSinceCollection <= 2160) return 40; // 3 months
    return 20;
  }

  calculateOverallQualityScore(): number {
    if (!this.qualityMetrics) return 0;
    
    const weights = {
      completeness: 0.25,
      accuracy: 0.25,
      consistency: 0.15,
      validity: 0.15,
      uniqueness: 0.10,
      timeliness: 0.10,
    };
    
    return (
      this.qualityMetrics.completeness * weights.completeness +
      this.qualityMetrics.accuracy * weights.accuracy +
      this.qualityMetrics.consistency * weights.consistency +
      this.qualityMetrics.validity * weights.validity +
      this.qualityMetrics.uniqueness * weights.uniqueness +
      this.qualityMetrics.timeliness * weights.timeliness
    );
  }

  getSizeCategory(): 'small' | 'medium' | 'large' | 'huge' {
    if (this.recordCount < 1000) return 'small';
    if (this.recordCount < 100000) return 'medium';
    if (this.recordCount < 1000000) return 'large';
    return 'huge';
  }

  generateDataProfile(): {
    summary: string;
    strengths: string[];
    weaknesses: string[];
    recommendations: string[];
  } {
    const size = this.getSizeCategory();
    const quality = this.dataQuality || DataQuality.FAIR;
    const completeness = this.getCompletenessScore();
    
    const summary = `${this.datasetName}: ${this.recordCount.toLocaleString()} records, ` +
                   `${this.featureCount} features, ${size} dataset with ${quality} quality (${completeness.toFixed(1)}% complete)`;
    
    const strengths = [];
    const weaknesses = [];
    const recommendations = [];
    
    if (this.isHighQuality()) {
      strengths.push('High data quality');
    } else {
      weaknesses.push('Data quality needs improvement');
      recommendations.push('Implement data quality improvement processes');
    }
    
    if (completeness >= 95) {
      strengths.push('Excellent data completeness');
    } else if (completeness < 80) {
      weaknesses.push('Significant missing data');
      recommendations.push('Address missing data with imputation or collection');
    }
    
    if (this.getOutlierPercentage() > 5) {
      weaknesses.push('High outlier percentage');
      recommendations.push('Review and handle outliers appropriately');
    }
    
    if (this.recordCount < 1000) {
      weaknesses.push('Small dataset size may limit model performance');
      recommendations.push('Consider data augmentation or collect more data');
    }
    
    if (this.getDataFreshness() < 50) {
      weaknesses.push('Data is becoming stale');
      recommendations.push('Update data collection frequency');
    }
    
    return { summary, strengths, weaknesses, recommendations };
  }

  generateQualityReport(): {
    overallScore: number;
    dimensions: any;
    issues: any[];
    suggestions: string[];
  } {
    const overallScore = this.calculateOverallQualityScore();
    
    const dimensions = {
      completeness: this.qualityMetrics?.completeness || 0,
      accuracy: this.qualityMetrics?.accuracy || 0,
      consistency: this.qualityMetrics?.consistency || 0,
      validity: this.qualityMetrics?.validity || 0,
      uniqueness: this.qualityMetrics?.uniqueness || 0,
      timeliness: this.qualityMetrics?.timeliness || 0,
    };
    
    const issues = [];
    const suggestions = [];
    
    if (dimensions.completeness < 90) {
      issues.push({
        type: 'completeness',
        severity: dimensions.completeness < 70 ? 'high' : 'medium',
        description: `${(100 - dimensions.completeness).toFixed(1)}% missing data`,
      });
      suggestions.push('Implement missing data handling strategies');
    }
    
    if (dimensions.uniqueness < 95) {
      issues.push({
        type: 'duplicates',
        severity: dimensions.uniqueness < 85 ? 'high' : 'medium',
        description: `${(100 - dimensions.uniqueness).toFixed(1)}% duplicate records`,
      });
      suggestions.push('Remove or handle duplicate records');
    }
    
    if (dimensions.validity < 95) {
      issues.push({
        type: 'validity',
        severity: dimensions.validity < 80 ? 'high' : 'medium',
        description: 'Data format or constraint violations detected',
      });
      suggestions.push('Validate and clean data format issues');
    }
    
    return { overallScore, dimensions, issues, suggestions };
  }

  // Static factory methods
  static createFromCSV(data: {
    userId: string;
    name: string;
    filePath: string;
    schema: any;
    recordCount: number;
  }): Partial<AITrainingData> {
    return {
      userId: data.userId,
      datasetName: data.name,
      dataType: DataType.MIXED,
      dataSource: DataSource.FILE_UPLOAD,
      processingStatus: ProcessingStatus.RAW,
      filePath: data.filePath,
      fileFormat: 'csv',
      recordCount: data.recordCount,
      featureCount: data.schema.features?.length || 0,
      schema: data.schema,
      collectedAt: new Date(),
      version: '1.0.0',
      isActive: true,
    };
  }

  static createFromAPI(data: {
    userId: string;
    name: string;
    source: DataSource;
    endpoint: string;
    schema: any;
  }): Partial<AITrainingData> {
    return {
      userId: data.userId,
      datasetName: data.name,
      dataType: DataType.MIXED,
      dataSource: data.source,
      processingStatus: ProcessingStatus.RAW,
      schema: data.schema,
      collectedAt: new Date(),
      version: '1.0.0',
      isActive: true,
      externalReferences: {
        apiEndpoints: [data.endpoint],
      },
    };
  }

  static createTimeSeries(data: {
    userId: string;
    name: string;
    timeColumn: string;
    valueColumns: string[];
    frequency: string;
  }): Partial<AITrainingData> {
    const features = [
      {
        name: data.timeColumn,
        type: 'datetime' as const,
        required: true,
        description: 'Timestamp column',
      },
      ...data.valueColumns.map(col => ({
        name: col,
        type: 'numeric' as const,
        required: true,
        description: 'Time series value',
      })),
    ];

    return {
      userId: data.userId,
      datasetName: data.name,
      dataType: DataType.TIME_SERIES,
      dataSource: DataSource.DATABASE,
      processingStatus: ProcessingStatus.RAW,
      schema: {
        features,
        indexes: [data.timeColumn],
      },
      collectedAt: new Date(),
      collectionFrequency: data.frequency,
      version: '1.0.0',
      isActive: true,
    };
  }
}