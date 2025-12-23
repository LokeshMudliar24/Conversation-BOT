
export enum FlowStep {
  WELCOME = 'WELCOME',
  OPTION_SELECTED = 'OPTION_SELECTED',
  AWAITING_PRESCRIPTION = 'AWAITING_PRESCRIPTION',
  PROCESSING = 'PROCESSING',
  VALIDATION_FEEDBACK = 'VALIDATION_FEEDBACK',
  REVIEW_TESTS = 'REVIEW_TESTS',
  FINAL_REVIEW = 'FINAL_REVIEW',
  PAYMENT = 'PAYMENT',
  CONFIRMED = 'CONFIRMED',
  AGENT_FALLBACK = 'AGENT_FALLBACK'
}

export interface Address {
  id: string;
  label: string;
  details: string;
}

export interface Provider {
  id: string;
  name: string;
  rating: number;
  deliveryFee: number;
  optionalTestPrice: number;
}

export interface TestItem {
  test_name: string;
  confidence: number;
  source: 'prescription' | 'recommended';
  reason?: string;
  coverage?: 'insurance' | 'pay_and_book';
}

export interface PrescriptionData {
  prescription_valid: boolean;
  validation_issues: string[];
  patient_details: {
    name: string;
    age: string;
    gender: string;
  };
  doctor_details: {
    name: string;
    degree: string;
  };
  diagnosis: string;
  tests_extracted: TestItem[];
  optional_tests: TestItem[];
  flags: string[];
}

export interface Message {
  id: string;
  role: 'assistant' | 'user' | 'system';
  content: string;
  type?: 'text' | 'options' | 'prescription_review' | 'cart' | 'status' | 'address_picker' | 'provider_picker';
  options?: string[];
  data?: any;
}
