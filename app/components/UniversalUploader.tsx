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
        <label htmlFor="case-name" className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
          Case Name
        </label>
        <input
          id="case-name"
          type="text"
          value={caseName}
          onChange={(e) => setCaseName(e.target.value)}
          placeholder="Enter case name"
          className="w-full px-3 py-2 rounded-xl shadow-chatgpt focus:shadow-chatgpt-hover transition-all duration-200"
          style={{
            backgroundColor: 'var(--background-primary)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-subtle)'
          }}
        />
      </div>

      {/* Drop Zone */}
      <div
        {...getRootProps()}
        className="relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-200 shadow-chatgpt hover:shadow-chatgpt-hover"
        style={{
          borderColor: dropzoneDragActive || isDragActive ? 'var(--accent)' : 'var(--border-subtle)',
          backgroundColor: dropzoneDragActive || isDragActive ? 'var(--background-secondary)' : 'var(--background-primary)'
        }}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center justify-center space-y-3">
          <div className="p-3 rounded-full" style={{ backgroundColor: dropzoneDragActive || isDragActive ? 'var(--accent)' : 'var(--background-secondary)' }}>
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: dropzoneDragActive || isDragActive ? '#ffffff' : 'var(--text-secondary)' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <div>
            <p className="text-lg font-medium" style={{ color: dropzoneDragActive || isDragActive ? 'var(--accent)' : 'var(--text-primary)' }}>
              {dropzoneDragActive || isDragActive ? 'Drop your document here' : 'Drop document here'}
            </p>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              PDF • DOCX • Images • TXT • Scanned files
            </p>
          </div>
        </div>
      </div>

      {/* Status Message */}
      {status && (
        <div className="p-3 rounded-xl text-sm font-medium shadow-chatgpt transition-all duration-200" style={{
          backgroundColor: status.startsWith('✅')
            ? 'rgba(16, 163, 127, 0.1)'
            : status.startsWith('❌')
            ? 'rgba(239, 68, 68, 0.1)'
            : 'rgba(16, 163, 127, 0.1)',
          color: status.startsWith('✅')
            ? 'var(--accent)'
            : status.startsWith('❌')
            ? '#ef4444'
            : 'var(--accent)',
          border: `1px solid ${status.startsWith('✅')
            ? 'rgba(16, 163, 127, 0.2)'
            : status.startsWith('❌')
            ? 'rgba(239, 68, 68, 0.2)'
            : 'rgba(16, 163, 127, 0.2)'}`
        }}>
          {status}
        </div>
      )}
    </div>
  );
}