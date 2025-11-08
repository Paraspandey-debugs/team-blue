"use client";
import { useState } from "react";
import { useDropzone } from "react-dropzone";

export default function UniversalUploader() {
  const [status, setStatus] = useState("");
  const [caseName, setCaseName] = useState("default-case");
  const [isDragActive, setIsDragActive] = useState(false);

  const onDrop = async (files: File[]) => {
    const file = files[0];
    setStatus("Uploading & processing...");

    const token = localStorage.getItem('jwt_token');
    if (!token) {
      setStatus("❌ Error: Not authenticated");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("metadata", JSON.stringify({
      project: "Legal Documents",
      category: "case",
      tags: ["2025", "confidential"],
      caseName: caseName,
    }));

    const res = await fetch("/api/upload-document", {
      method: "POST",
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });
    const data = await res.json();
    setStatus(data.success ? `✅ Success! ${data.chunks} chunks indexed` : `❌ Error: ${data.error}`);
  };

  const { getRootProps, getInputProps, isDragActive: dropzoneDragActive } = useDropzone({
    onDrop,
    onDragEnter: () => setIsDragActive(true),
    onDragLeave: () => setIsDragActive(false)
  });

  return (
    <div className="space-y-4">
      {/* Case Name Input */}
      <div>
        <label htmlFor="case-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Case Name
        </label>
        <input
          id="case-name"
          type="text"
          value={caseName}
          onChange={(e) => setCaseName(e.target.value)}
          placeholder="Enter case name"
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm placeholder-gray-400 dark:placeholder-gray-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-colors"
        />
      </div>

      {/* Drop Zone */}
      <div
        {...getRootProps()}
        className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-200 ${
          dropzoneDragActive || isDragActive
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 scale-105'
            : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 bg-gray-50 dark:bg-gray-800'
        }`}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center justify-center space-y-3">
          <div className={`p-3 rounded-full ${dropzoneDragActive || isDragActive ? 'bg-blue-100 dark:bg-blue-800' : 'bg-gray-100 dark:bg-gray-700'}`}>
            <svg className={`w-8 h-8 ${dropzoneDragActive || isDragActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <div>
            <p className={`text-lg font-medium ${dropzoneDragActive || isDragActive ? 'text-blue-700 dark:text-blue-300' : 'text-gray-900 dark:text-white'}`}>
              {dropzoneDragActive || isDragActive ? 'Drop your document here' : 'Drop document here'}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              PDF • DOCX • Images • TXT • Scanned files
            </p>
          </div>
        </div>
      </div>

      {/* Status Message */}
      {status && (
        <div className={`p-3 rounded-lg text-sm font-medium ${
          status.startsWith('✅')
            ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800'
            : status.startsWith('❌')
            ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
            : 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
        }`}>
          {status}
        </div>
      )}
    </div>
  );
}