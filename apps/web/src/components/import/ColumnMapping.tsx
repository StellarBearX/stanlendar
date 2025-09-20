'use client';

import React from 'react';

interface ColumnMappingProps {
  headers: string[];
  rows: Array<Record<string, any>>;
  columnMapping: Record<string, string>;
  onMappingChange: (csvColumn: string, dbField: string) => void;
  onSaveMapping?: (mapping: Record<string, string>) => void;
  onLoadMapping?: () => void;
  savedMappings?: Array<{ name: string; mapping: Record<string, string> }>;
}

const FIELD_OPTIONS = [
  { value: '', label: 'Skip this column', required: false },
  { value: 'subjectName', label: 'Subject Name', required: true },
  { value: 'sectionCode', label: 'Section Code', required: true },
  { value: 'teacher', label: 'Teacher', required: false },
  { value: 'room', label: 'Room', required: false },
  { value: 'startTime', label: 'Start Time', required: true },
  { value: 'endTime', label: 'End Time', required: true },
  { value: 'daysOfWeek', label: 'Days of Week', required: true },
  { value: 'startDate', label: 'Start Date', required: false },
  { value: 'endDate', label: 'End Date', required: false },
  { value: 'note', label: 'Note', required: false },
];

export default function ColumnMapping({
  headers,
  rows,
  columnMapping,
  onMappingChange,
  onSaveMapping,
  onLoadMapping,
  savedMappings = [],
}: ColumnMappingProps) {
  const getRequiredFields = () => {
    return FIELD_OPTIONS.filter(option => option.required).map(option => option.value);
  };

  const getMappedFields = () => {
    return Object.values(columnMapping).filter(field => field !== '');
  };

  const getMissingRequiredFields = () => {
    const requiredFields = getRequiredFields();
    const mappedFields = getMappedFields();
    return requiredFields.filter(field => !mappedFields.includes(field));
  };

  const getDuplicateMappings = () => {
    const mappedFields = getMappedFields();
    const duplicates = mappedFields.filter((field, index) => 
      mappedFields.indexOf(field) !== index
    );
    return [...new Set(duplicates)];
  };

  const isValidMapping = () => {
    const missingRequired = getMissingRequiredFields();
    const duplicates = getDuplicateMappings();
    return missingRequired.length === 0 && duplicates.length === 0;
  };

  const handleAutoMap = () => {
    const autoMapping: Record<string, string> = {};
    
    headers.forEach(header => {
      const lowerHeader = header.toLowerCase().replace(/[^a-z0-9]/g, '');
      
      // More sophisticated auto-mapping logic
      if (lowerHeader.includes('subject') || lowerHeader.includes('course')) {
        autoMapping[header] = 'subjectName';
      } else if (lowerHeader.includes('section') || lowerHeader.includes('sec')) {
        autoMapping[header] = 'sectionCode';
      } else if (lowerHeader.includes('teacher') || lowerHeader.includes('instructor') || lowerHeader.includes('prof')) {
        autoMapping[header] = 'teacher';
      } else if (lowerHeader.includes('room') || lowerHeader.includes('location') || lowerHeader.includes('venue')) {
        autoMapping[header] = 'room';
      } else if ((lowerHeader.includes('start') || lowerHeader.includes('begin')) && lowerHeader.includes('time')) {
        autoMapping[header] = 'startTime';
      } else if ((lowerHeader.includes('end') || lowerHeader.includes('finish')) && lowerHeader.includes('time')) {
        autoMapping[header] = 'endTime';
      } else if (lowerHeader.includes('day') || lowerHeader.includes('schedule')) {
        autoMapping[header] = 'daysOfWeek';
      } else if ((lowerHeader.includes('start') || lowerHeader.includes('begin')) && lowerHeader.includes('date')) {
        autoMapping[header] = 'startDate';
      } else if ((lowerHeader.includes('end') || lowerHeader.includes('finish')) && lowerHeader.includes('date')) {
        autoMapping[header] = 'endDate';
      } else if (lowerHeader.includes('note') || lowerHeader.includes('comment') || lowerHeader.includes('remark')) {
        autoMapping[header] = 'note';
      }
    });

    // Apply the auto-mapping
    Object.entries(autoMapping).forEach(([csvColumn, dbField]) => {
      onMappingChange(csvColumn, dbField);
    });
  };

  const handleClearMapping = () => {
    headers.forEach(header => {
      onMappingChange(header, '');
    });
  };

  const missingRequired = getMissingRequiredFields();
  const duplicates = getDuplicateMappings();

  return (
    <div className="space-y-6">
      {/* Header with actions */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Column Mapping</h3>
        <div className="flex space-x-2">
          <button
            onClick={handleAutoMap}
            className="text-sm bg-blue-100 text-blue-700 px-3 py-1 rounded hover:bg-blue-200"
          >
            Auto Map
          </button>
          <button
            onClick={handleClearMapping}
            className="text-sm bg-gray-100 text-gray-700 px-3 py-1 rounded hover:bg-gray-200"
          >
            Clear All
          </button>
        </div>
      </div>

      {/* Validation messages */}
      {missingRequired.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <h4 className="text-red-800 font-medium">Missing Required Fields</h4>
          <p className="text-red-700 text-sm mt-1">
            The following required fields are not mapped: {missingRequired.join(', ')}
          </p>
        </div>
      )}

      {duplicates.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
          <h4 className="text-yellow-800 font-medium">Duplicate Mappings</h4>
          <p className="text-yellow-700 text-sm mt-1">
            The following fields are mapped multiple times: {duplicates.join(', ')}
          </p>
        </div>
      )}

      {/* Mapping table */}
      <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
        <table className="min-w-full divide-y divide-gray-300">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                CSV Column
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Map to Field
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Sample Data
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {headers.map((header) => {
              const mappedField = columnMapping[header] || '';
              const fieldOption = FIELD_OPTIONS.find(opt => opt.value === mappedField);
              const isRequired = fieldOption?.required || false;
              const isDuplicate = duplicates.includes(mappedField) && mappedField !== '';
              
              return (
                <tr key={header} className={isDuplicate ? 'bg-yellow-50' : ''}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <span className="text-sm font-medium text-gray-900">{header}</span>
                      {isRequired && (
                        <span className="ml-2 text-xs text-red-600">*</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <select
                      value={mappedField}
                      onChange={(e) => onMappingChange(header, e.target.value)}
                      className={`block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm ${
                        isDuplicate ? 'border-yellow-400 bg-yellow-50' : ''
                      }`}
                    >
                      {FIELD_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                          {option.required ? ' *' : ''}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {rows[0]?.[header] ? (
                      <span className="truncate max-w-xs block">
                        {String(rows[0][header])}
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mapping summary */}
      <div className="bg-gray-50 rounded-md p-4">
        <h4 className="text-sm font-medium text-gray-900 mb-2">Mapping Summary</h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-600">Total columns:</span>
            <span className="ml-2 font-medium">{headers.length}</span>
          </div>
          <div>
            <span className="text-gray-600">Mapped columns:</span>
            <span className="ml-2 font-medium">{getMappedFields().length}</span>
          </div>
          <div>
            <span className="text-gray-600">Required fields:</span>
            <span className="ml-2 font-medium">{getRequiredFields().length}</span>
          </div>
          <div>
            <span className="text-gray-600">Status:</span>
            <span className={`ml-2 font-medium ${isValidMapping() ? 'text-green-600' : 'text-red-600'}`}>
              {isValidMapping() ? 'Valid' : 'Invalid'}
            </span>
          </div>
        </div>
      </div>

      {/* Saved mappings */}
      {savedMappings.length > 0 && (
        <div className="border-t pt-6">
          <h4 className="text-sm font-medium text-gray-900 mb-3">Saved Mappings</h4>
          <div className="space-y-2">
            {savedMappings.map((saved, index) => (
              <div key={index} className="flex items-center justify-between bg-gray-50 rounded p-3">
                <span className="text-sm text-gray-700">{saved.name}</span>
                <button
                  onClick={() => {
                    Object.entries(saved.mapping).forEach(([csvColumn, dbField]) => {
                      if (headers.includes(csvColumn)) {
                        onMappingChange(csvColumn, dbField);
                      }
                    });
                  }}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  Load
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}