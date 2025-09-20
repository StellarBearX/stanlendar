'use client';

import React, { useState } from 'react';

interface DataPreviewProps {
  headers: string[];
  rows: Array<Record<string, any>>;
  totalRows: number;
  columnMapping?: Record<string, string>;
  validationErrors?: Array<{
    row: number;
    column?: string;
    message: string;
    value?: any;
  }>;
  maxPreviewRows?: number;
}

export default function DataPreview({
  headers,
  rows,
  totalRows,
  columnMapping = {},
  validationErrors = [],
  maxPreviewRows = 10,
}: DataPreviewProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const [showErrorsOnly, setShowErrorsOnly] = useState(false);
  
  const rowsPerPage = maxPreviewRows;
  const totalPages = Math.ceil(rows.length / rowsPerPage);
  
  // Get error rows for filtering
  const errorRowNumbers = new Set(validationErrors.map(error => error.row - 1)); // Convert to 0-based index
  
  // Filter rows based on error filter
  const filteredRows = showErrorsOnly 
    ? rows.filter((_, index) => errorRowNumbers.has(index))
    : rows;
  
  const paginatedRows = filteredRows.slice(
    currentPage * rowsPerPage,
    (currentPage + 1) * rowsPerPage
  );

  const getColumnErrors = (rowIndex: number, columnName: string) => {
    const actualRowNumber = showErrorsOnly 
      ? rows.findIndex(row => row === filteredRows[rowIndex]) + 1
      : (currentPage * rowsPerPage) + rowIndex + 1;
      
    return validationErrors.filter(
      error => error.row === actualRowNumber && error.column === columnName
    );
  };

  const getMappedFieldName = (csvColumn: string) => {
    const mappedField = columnMapping[csvColumn];
    if (!mappedField) return null;
    
    const fieldLabels: Record<string, string> = {
      subjectName: 'Subject Name',
      sectionCode: 'Section Code',
      teacher: 'Teacher',
      room: 'Room',
      startTime: 'Start Time',
      endTime: 'End Time',
      daysOfWeek: 'Days of Week',
      startDate: 'Start Date',
      endDate: 'End Date',
      note: 'Note',
    };
    
    return fieldLabels[mappedField] || mappedField;
  };

  const getCellClassName = (rowIndex: number, columnName: string) => {
    const errors = getColumnErrors(rowIndex, columnName);
    const baseClass = 'px-6 py-4 whitespace-nowrap text-sm';
    
    if (errors.length > 0) {
      return `${baseClass} bg-red-50 text-red-900 border-l-2 border-red-400`;
    }
    
    return `${baseClass} text-gray-900`;
  };

  const formatCellValue = (value: any) => {
    if (value === null || value === undefined || value === '') {
      return <span className="text-gray-400 italic">empty</span>;
    }
    
    const stringValue = String(value);
    if (stringValue.length > 50) {
      return (
        <span title={stringValue}>
          {stringValue.substring(0, 47)}...
        </span>
      );
    }
    
    return stringValue;
  };

  return (
    <div className="space-y-4">
      {/* Header with stats and controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h3 className="text-lg font-medium">Data Preview</h3>
          <div className="text-sm text-gray-600">
            Showing {paginatedRows.length} of {filteredRows.length} rows
            {totalRows > rows.length && (
              <span className="ml-1">
                (total: {totalRows} rows in file)
              </span>
            )}
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          {validationErrors.length > 0 && (
            <label className="flex items-center text-sm">
              <input
                type="checkbox"
                checked={showErrorsOnly}
                onChange={(e) => {
                  setShowErrorsOnly(e.target.checked);
                  setCurrentPage(0); // Reset to first page
                }}
                className="mr-2 rounded border-gray-300 text-red-600 focus:ring-red-500"
              />
              Show errors only ({errorRowNumbers.size} rows)
            </label>
          )}
        </div>
      </div>

      {/* Error summary */}
      {validationErrors.length > 0 && !showErrorsOnly && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex items-center">
            <div className="text-red-600 text-lg mr-3">⚠️</div>
            <div>
              <h4 className="text-red-800 font-medium">
                {validationErrors.length} validation error{validationErrors.length !== 1 ? 's' : ''} found
              </h4>
              <p className="text-red-700 text-sm">
                Errors are highlighted in red. Use the "Show errors only" filter to focus on problematic rows.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Data table */}
      <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-300">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Row #
                </th>
                {headers.map((header) => {
                  const mappedField = getMappedFieldName(header);
                  return (
                    <th
                      key={header}
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      <div>
                        <div className="font-medium text-gray-900">{header}</div>
                        {mappedField && (
                          <div className="text-xs text-blue-600 mt-1">
                            → {mappedField}
                          </div>
                        )}
                        {!mappedField && columnMapping[header] === '' && (
                          <div className="text-xs text-gray-400 mt-1">
                            (skipped)
                          </div>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedRows.map((row, rowIndex) => {
                const actualRowNumber = showErrorsOnly 
                  ? rows.findIndex(r => r === row) + 1
                  : (currentPage * rowsPerPage) + rowIndex + 1;
                
                const hasRowErrors = validationErrors.some(error => error.row === actualRowNumber);
                
                return (
                  <tr key={rowIndex} className={hasRowErrors ? 'bg-red-25' : ''}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {actualRowNumber}
                      {hasRowErrors && (
                        <span className="ml-2 text-red-600">⚠️</span>
                      )}
                    </td>
                    {headers.map((header) => {
                      const cellErrors = getColumnErrors(rowIndex, header);
                      return (
                        <td
                          key={header}
                          className={getCellClassName(rowIndex, header)}
                          title={cellErrors.length > 0 ? cellErrors.map(e => e.message).join('; ') : undefined}
                        >
                          {formatCellValue(row[header])}
                          {cellErrors.length > 0 && (
                            <div className="text-xs text-red-600 mt-1">
                              {cellErrors[0].message}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-700">
            Page {currentPage + 1} of {totalPages}
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
              disabled={currentPage === 0}
              className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))}
              disabled={currentPage === totalPages - 1}
              className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {filteredRows.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-400 text-lg mb-2">📄</div>
          <p className="text-gray-500">
            {showErrorsOnly ? 'No rows with errors found' : 'No data to preview'}
          </p>
        </div>
      )}
    </div>
  );
}