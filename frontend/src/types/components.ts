import { ReactNode } from 'react';

// Component Props Types
export interface ButtonProps {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'ghost';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
  className?: string;
}

export interface InputProps {
  name: string;
  type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url';
  label?: string;
  placeholder?: string;
  value?: string | number;
  defaultValue?: string | number;
  required?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  error?: string;
  helperText?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  onFocus?: () => void;
  className?: string;
}

export interface SelectProps {
  name: string;
  label?: string;
  placeholder?: string;
  options: SelectOption[];
  value?: string | number;
  defaultValue?: string | number;
  multiple?: boolean;
  searchable?: boolean;
  clearable?: boolean;
  disabled?: boolean;
  required?: boolean;
  error?: string;
  helperText?: string;
  onChange?: (value: string | number | Array<string | number>) => void;
  className?: string;
}

export interface SelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
  group?: string;
}

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'full';
  closable?: boolean;
  maskClosable?: boolean;
  footer?: ReactNode;
  className?: string;
}

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  placement?: 'left' | 'right' | 'top' | 'bottom';
  size?: number | string;
  closable?: boolean;
  maskClosable?: boolean;
  footer?: ReactNode;
  className?: string;
}

export interface TabsProps {
  defaultTab?: string;
  activeTab?: string;
  onChange?: (tab: string) => void;
  children: ReactNode;
  className?: string;
}

export interface TabProps {
  value: string;
  label: string;
  disabled?: boolean;
  children: ReactNode;
}

export interface CardProps {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  actions?: ReactNode;
  hoverable?: boolean;
  loading?: boolean;
  className?: string;
}

export interface AlertProps {
  type: 'info' | 'success' | 'warning' | 'error';
  title?: string;
  message: string;
  closable?: boolean;
  onClose?: () => void;
  className?: string;
}

export interface BadgeProps {
  children: ReactNode;
  variant?: 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error';
  size?: 'sm' | 'md' | 'lg';
  dot?: boolean;
  count?: number;
  maxCount?: number;
  showZero?: boolean;
  className?: string;
}

export interface AvatarProps {
  src?: string;
  alt?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  shape?: 'circle' | 'square';
  fallback?: string;
  className?: string;
}

export interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  trigger?: 'hover' | 'click' | 'focus';
  delay?: number;
  className?: string;
}

export interface ProgressProps {
  value: number;
  max?: number;
  size?: 'sm' | 'md' | 'lg';
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'error';
  showLabel?: boolean;
  striped?: boolean;
  animated?: boolean;
  className?: string;
}

export interface LoadingProps {
  size?: 'sm' | 'md' | 'lg';
  type?: 'spinner' | 'dots' | 'pulse';
  text?: string;
  overlay?: boolean;
  className?: string;
}

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export interface DataTableProps<T = any> {
  columns: TableColumn<T>[];
  data: T[];
  loading?: boolean;
  pagination?: TablePagination;
  selection?: {
    selectedRows: string[];
    onSelectionChange: (selectedRows: string[]) => void;
  };
  sorting?: {
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    onSortChange: (sortBy: string, sortOrder: 'asc' | 'desc') => void;
  };
  filtering?: {
    filters: Record<string, any>;
    onFilterChange: (filters: Record<string, any>) => void;
  };
  onRowClick?: (row: T) => void;
  className?: string;
}

export interface TableColumn<T = any> {
  key: string;
  title: string;
  dataIndex?: keyof T;
  render?: (value: any, record: T, index: number) => ReactNode;
  sorter?: boolean | ((a: T, b: T) => number);
  filters?: Array<{ text: string; value: any }>;
  width?: number | string;
  align?: 'left' | 'center' | 'right';
  fixed?: 'left' | 'right';
  resizable?: boolean;
}

export interface TablePagination {
  current: number;
  pageSize: number;
  total: number;
  showSizeChanger?: boolean;
  showQuickJumper?: boolean;
  showTotal?: boolean;
  pageSizeOptions?: number[];
}

export interface BreadcrumbProps {
  items: BreadcrumbItem[];
  separator?: ReactNode;
  className?: string;
}

export interface BreadcrumbItem {
  title: string;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
}

export interface StepperProps {
  currentStep: number;
  steps: StepItem[];
  orientation?: 'horizontal' | 'vertical';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export interface StepItem {
  title: string;
  description?: string;
  icon?: ReactNode;
  disabled?: boolean;
  status?: 'pending' | 'current' | 'completed' | 'error';
}

export interface MenuProps {
  items: MenuItem[];
  mode?: 'horizontal' | 'vertical' | 'inline';
  theme?: 'light' | 'dark';
  selectedKeys?: string[];
  openKeys?: string[];
  onSelect?: (keys: string[]) => void;
  onOpenChange?: (keys: string[]) => void;
  className?: string;
}

export interface MenuItem {
  key: string;
  label: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
  children?: MenuItem[];
  type?: 'item' | 'group' | 'divider';
}

export interface FormProps {
  onSubmit: (values: any) => void;
  initialValues?: any;
  validationSchema?: any;
  children: ReactNode;
  className?: string;
}

export interface FormFieldProps {
  name: string;
  label?: string;
  required?: boolean;
  children: ReactNode;
  error?: string;
  helperText?: string;
  className?: string;
}