"use client";
import { useState } from "react";
import { useDropzone } from "react-dropzone";

export default function UniversalUploader() {
  const [status, setStatus] = useState("");

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
      <div {...getRootProps()} className="border-4 border-dashed border-blue-400 dark:border-blue-600 rounded-xl p-16 text-center cursor-pointer hover:border-blue-600 dark:hover:border-blue-500 transition bg-white dark:bg-gray-800">
        <input {...getInputProps()} />
        <p className="text-2xl text-gray-900 dark:text-white">Drop any document here</p>
        <p className="text-gray-500 dark:text-gray-400 mt-2">PDF • DOCX • Images • TXT • Scanned files</p>
      </div>
      {status && <p className="mt-6 text-lg font-medium text-gray-900 dark:text-white">{status}</p>}
    </div>
  );
}