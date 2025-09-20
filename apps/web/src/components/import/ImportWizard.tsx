'use client';

import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';

interface ImportWizardProps {
  onComplete?: () => void;
}

interface ImportPreview {
  jobId: string;
  headers: string[];
  rows: Array<Record<string, any>>;
  totalRows: number;
  errors: Array<{
    row: number;
    column?: string;
    message: string;
    value?: any;
  }>;
}

interface ColumnMapping {
  [csvColumn: string]: string;
}

const FIELD_OPTIONS = [
  { value: '', label: 'Skip this column' },
  { value: 'subjectName', label: 'Subject Name' },
  { value: 'sectionCode', label: 'Section Code' },
  { value: 'teacher', label: 'Teacher' },
  { value: 'room', label: 'Room' },
  { value: 'startTime', label: 'Start Time' },
  { value: 'endTime', label: 'End Time' },
  { value: 'daysOfWeek', label: 'Days of Week' },
  { value: 'startDate', label: 'Start Date' },
  { value: 'endDate', label: 'End Date' },
  { value: 'note', label: 'Note' },
];

export default function ImportWizard({ onComplete }: ImportWizardProps) {
  const [step, setStep] = useState<'upload' | 'mapping' | 'validation'>('upload');
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({});
  const [validationResult, setValidationResult] = useState<any>(null);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await api.post('/import/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    },
    onSuccess: (data: ImportPreview) => {
      setImportPreview(data);
      
      // Auto-suggest column mappings based on header names
      const autoMapping: ColumnMapping = {};
      data.headers.forEach(header => {
        const lowerHeader = header.toLowerCase();
        if (lowerHeader.includes('subject')) {
          autoMapping[header] = 'subjectName';
        } else if (lowerHeader.includes('section')) {
          autoMapping[header] = 'sectionCode';
        } else if (lowerHeader.includes('teacher') || lowerHeader.includes('instructor')) {
          autoMapping[header] = 'teacher';
        } else if (lowerHeader.includes('room')) {
          autoMapping[header] = 'room';
        } else if (lowerHeader.includes('start') && lowerHeader.includes('time')) {
          autoMapping[header] = 'startTime';
        } else if (lowerHeader.includes('end') && lowerHeader.includes('time')) {
          autoMapping[header] = 'endTime';
        } else if (lowerHeader.includes('day')) {
          autoMapping[header] = 'daysOfWeek';
        } else if (lowerHeader.includes('start') && lowerHeader.includes('date')) {
          autoMapping[header] = 'startDate';
        } else if (lowerHeader.includes('end') && lowerHeader.includes('date')) {
          autoMapping[header] = 'endDate';
        }
      });
      
      setColumnMapping(autoMapping);
      setStep('mapping');
    },
  });

  const mappingMutation = useMutation({
    mutationFn: async (mapping: ColumnMapping) => {
      if (!importPreview) throw new Error('No import preview available');
      
      await api.put(`/import/jobs/${importPreview.jobId}/mapping`, {
        columnMapping: mapping,
      });
      
      const response = await api.post(`/import/jobs/${importPreview.jobId}/validate`);
      return response.data;
    },
    onSuccess: (data) => {
      setValidationResult(data);
      setStep('validation');
    },
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      uploadMutation.mutate(acceptedFiles[0]);
    }
  }, [uploadMutation]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024, // 10MB
  });

  const handleMappingChange = (csvColumn: string, dbField: string) => {
    setColumnMapping(prev => ({
      ...prev,
      [csvColumn]: dbField,
    }));
  };

  const handleValidateMapping = () => {
    mappingMutation.mutate(columnMapping);
  };

  const handleStartOver = () => {
    setStep('upload');
    setImportPreview(null);
    setColumnMapping({});
    setValidationResult(null);
  };

  if (step === 'upload') {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <h2 className="text-2xl font-bold mb-6">Import Class Schedule</h2>
        
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            isDragActive
              ? 'border-blue-400 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400'
          }`}
        >
          <input {...getInputProps()} />
          
          <div className="space-y-4">
            <div className="text-4xl">📁</div>
            
            {isDragActive ? (
              <p className="text-lg text-blue-600">Drop the file here...</p>
            ) : (
              <>
                <p className="text-lg">Drag and drop your file here, or click to select</p>
                <p className="text-sm text-gray-500">
                  Supports CSV and XLSX files up to 10MB
                </p>
              </>
            )}
          </div>
        </div>

        {uploadMutation.isPending && (
          <div className="mt-4 text-center">
            <div className="inline-flex items-center space-x-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              <span>Uploading and parsing file...</span>
            </div>
          </div>
        )}

        {uploadMutation.error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-800">
              Error: {uploadMutation.error.message}
            </p>
          </div>
        )}

        <div className="mt-6 text-sm text-gray-600">
          <h3 className="font-medium mb-2">Expected file format:</h3>
          <ul className="space-y-1">
            <li>• Subject Name (required)</li>
            <li>• Section Code (required)</li>
            <li>• Start Time (required, HH:mm format)</li>
            <li>• End Time (required, HH:mm format)</li>
            <li>• Days of Week (required, e.g., "MO,WE,FR")</li>
            <li>• Room (optional)</li>
            <li>• Teacher (optional)</li>
            <li>• Start Date (optional, YYYY-MM-DD)</li>
            <li>• End Date (optional, YYYY-MM-DD)</li>
          </ul>
        </div>
      </div>
    );
  }

  if (step === 'mapping' && importPreview) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Map Columns</h2>
          <button
            onClick={handleStartOver}
            className="text-sm text-gray-600 hover:text-gray-800"
          >
            Start Over
          </button>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-6">
          <p className="text-blue-800">
            Found {importPreview.totalRows} rows in your file. 
            Please map each column to the corresponding field.
          </p>
        </div>

        <div className="space-y-4 mb-6">
          {importPreview.headers.map((header) => (
            <div key={header} className="flex items-center space-x-4">
              <div className="w-1/3">
                <label className="block text-sm font-medium text-gray-700">
                  {header}
                </label>
              </div>
              
              <div className="w-1/3">
                <select
                  value={columnMapping[header] || ''}
                  onChange={(e) => handleMappingChange(header, e.target.value)}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  {FIELD_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="w-1/3 text-sm text-gray-600">
                {importPreview.rows[0]?.[header] && (
                  <span>Example: {String(importPreview.rows[0][header])}</span>
                )}
              </div>
            </div>
          ))}
        </div>

        {importPreview.rows.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-medium mb-3">Preview (first 5 rows)</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {importPreview.headers.map((header) => (
                      <th
                        key={header}
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {importPreview.rows.slice(0, 5).map((row, index) => (
                    <tr key={index}>
                      {importPreview.headers.map((header) => (
                        <td
                          key={header}
                          className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                        >
                          {row[header] || '-'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="flex justify-end space-x-4">
          <button
            onClick={handleValidateMapping}
            disabled={mappingMutation.isPending}
            className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {mappingMutation.isPending ? 'Validating...' : 'Validate & Continue'}
          </button>
        </div>

        {mappingMutation.error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-800">
              Error: {mappingMutation.error.message}
            </p>
          </div>
        )}
      </div>
    );
  }

  if (step === 'validation' && validationResult) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Validation Results</h2>
          <button
            onClick={handleStartOver}
            className="text-sm text-gray-600 hover:text-gray-800"
          >
            Start Over
          </button>
        </div>

        {validationResult.isValid ? (
          <div className="bg-green-50 border border-green-200 rounded-md p-4 mb-6">
            <div className="flex items-center">
              <div className="text-green-600 text-xl mr-3">✓</div>
              <div>
                <h3 className="text-green-800 font-medium">Validation Passed</h3>
                <p className="text-green-700">
                  Your data is ready to import. You can proceed to the next step.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
            <div className="flex items-center">
              <div className="text-red-600 text-xl mr-3">✗</div>
              <div>
                <h3 className="text-red-800 font-medium">Validation Failed</h3>
                <p className="text-red-700">
                  Please fix the errors below before proceeding.
                </p>
              </div>
            </div>
          </div>
        )}

        {validationResult.errors && validationResult.errors.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-medium text-red-800 mb-3">Errors</h3>
            <div className="space-y-2">
              {validationResult.errors.map((error: any, index: number) => (
                <div key={index} className="bg-red-50 border border-red-200 rounded p-3">
                  <div className="text-sm">
                    <span className="font-medium">Row {error.row}:</span>
                    {error.column && <span className="text-gray-600"> ({error.column})</span>}
                    <span className="ml-2">{error.message}</span>
                    {error.value && (
                      <span className="ml-2 text-gray-600">
                        Value: "{error.value}"
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {validationResult.warnings && validationResult.warnings.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-medium text-yellow-800 mb-3">Warnings</h3>
            <div className="space-y-2">
              {validationResult.warnings.map((warning: any, index: number) => (
                <div key={index} className="bg-yellow-50 border border-yellow-200 rounded p-3">
                  <div className="text-sm">
                    <span className="font-medium">Row {warning.row}:</span>
                    {warning.column && <span className="text-gray-600"> ({warning.column})</span>}
                    <span className="ml-2">{warning.message}</span>
                    {warning.value && (
                      <span className="ml-2 text-gray-600">
                        Value: "{warning.value}"
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-between">
          <button
            onClick={() => setStep('mapping')}
            className="text-gray-600 hover:text-gray-800"
          >
            ← Back to Mapping
          </button>
          
          {validationResult.isValid && (
            <ProcessImportButton
              jobId={importPreview.jobId}
              onComplete={onComplete}
            />
          )}
        </div>
      </div>
    );
  }

  return null;
}

interface ProcessImportButtonProps {
  jobId: string;
  onComplete?: () => void;
}

function ProcessImportButton({ jobId, onComplete }: ProcessImportButtonProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleProcessImport = async () => {
    setIsProcessing(true);
    setError(null);

    try {
      const response = await api.post(`/import/jobs/${jobId}/apply`);
      setResult(response.data);
      
      if (response.data.summary.failed === 0) {
        setTimeout(() => {
          onComplete?.();
        }, 2000);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Import processing failed');
    } finally {
      setIsProcessing(false);
    }
  };

  if (result) {
    return (
      <div className="space-y-4">
        <div className={`p-4 rounded-md ${
          result.summary.failed === 0 ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'
        }`}>
          <h3 className={`font-medium ${
            result.summary.failed === 0 ? 'text-green-800' : 'text-yellow-800'
          }`}>
            Import {result.summary.failed === 0 ? 'Completed Successfully' : 'Completed with Issues'}
          </h3>
          <div className="mt-2 text-sm">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-gray-600">Total rows:</span>
                <span className="ml-2 font-medium">{result.summary.totalRows}</span>
              </div>
              <div>
                <span className="text-green-600">Created:</span>
                <span className="ml-2 font-medium">{result.summary.created}</span>
              </div>
              <div>
                <span className="text-blue-600">Updated:</span>
                <span className="ml-2 font-medium">{result.summary.updated}</span>
              </div>
              <div>
                <span className="text-red-600">Failed:</span>
                <span className="ml-2 font-medium">{result.summary.failed}</span>
              </div>
            </div>
          </div>
        </div>

        {result.summary.failed === 0 && (
          <div className="text-center text-green-600">
            ✓ Redirecting to dashboard...
          </div>
        )}

        {result.errors && result.errors.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium text-red-800">Errors:</h4>
            {result.errors.slice(0, 5).map((error: any, index: number) => (
              <div key={index} className="text-sm text-red-700 bg-red-50 p-2 rounded">
                Row {error.row}: {error.message}
              </div>
            ))}
            {result.errors.length > 5 && (
              <div className="text-sm text-gray-600">
                ... and {result.errors.length - 5} more errors
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}
      
      <button
        onClick={handleProcessImport}
        disabled={isProcessing}
        className="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isProcessing ? (
          <div className="flex items-center space-x-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            <span>Processing Import...</span>
          </div>
        ) : (
          'Proceed to Import'
        )}
      </button>
    </div>
  );
}