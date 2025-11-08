"use client";
import { useState } from "react";
import { useDropzone } from "react-dropzone";

export default function UniversalUploader() {
  const [status, setStatus] = useState("");
  const [caseName, setCaseName] = useState("default-case");

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

  const { getRootProps, getInputProps } = useDropzone({ onDrop });

  return (
    <div className="max-w-2xl mx-auto p-8">
      <div className="mb-4">
        <label htmlFor="case-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Case Name
        </label>
        <input
          id="case-name"
          type="text"
          value={caseName}
          onChange={(e) => setCaseName(e.target.value)}
          placeholder="Enter case name (e.g., smith-vs-jones)"
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 dark:placeholder-gray-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
        />
      </div>
      <div {...getRootProps()} className="border-4 border-dashed border-blue-400 dark:border-blue-600 rounded-xl p-16 text-center cursor-pointer hover:border-blue-600 dark:hover:border-blue-500 transition bg-white dark:bg-gray-800">
        <input {...getInputProps()} />
        <p className="text-2xl text-gray-900 dark:text-white">Drop any document here</p>
        <p className="text-gray-500 dark:text-gray-400 mt-2">PDF • DOCX • Images • TXT • Scanned files</p>
      </div>
      {status && <p className="mt-6 text-lg font-medium text-gray-900 dark:text-white">{status}</p>}
    </div>
  );
}