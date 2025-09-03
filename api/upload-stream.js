<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Storj File Upload/Download - Small & Large Files</title>
  <style>
    body { 
      font-family: Arial, sans-serif; 
      padding: 20px; 
      max-width: 800px; 
      margin: 0 auto; 
    }
    #status { 
      margin-top: 10px; 
      font-weight: bold; 
      padding: 10px;
      border-radius: 5px;
    }
    #status.error { 
      color: red; 
      background: #ffebee;
    }
    #status.success { 
      color: green; 
      background: #e8f5e8;
    }
    #status.loading { 
      color: blue; 
      background: #e3f2fd;
    }
    #status.info { 
      color: #333; 
      background: #f5f5f5;
    }
    pre { 
      background: #f4f4f4; 
      padding: 10px; 
      border-radius: 5px; 
      max-height: 300px;
      overflow-y: auto;
      white-space: pre-wrap;
    }
    .file-item { 
      display: flex; 
      align-items: center; 
      margin-bottom: 8px; 
      padding: 8px; 
      border: 1px solid #ddd; 
      border-radius: 4px; 
    }
    .file-name { 
      flex-grow: 1; 
      margin-right: 10px; 
      font-weight: 500;
    }
    button { 
      margin-left: 5px; 
      padding: 8px 12px; 
      cursor: pointer; 
      border: 1px solid #ccc;
      border-radius: 4px;
      background: #f8f9fa;
    }
    button:hover {
      background: #e9ecef;
    }
    button:disabled {
      background: #6c757d;
      color: white;
      cursor: not-allowed;
    }
    .upload-btn {
      background: #007bff;
      color: white;
      border-color: #007bff;
    }
    .upload-btn:hover:not(:disabled) {
      background: #0056b3;
    }
    .cancel-btn {
      background: #dc3545;
      color: white;
      border-color: #dc3545;
    }
    .cancel-btn:hover {
      background: #c82333;
    }
    .upload-method {
      background: #e7f3ff;
      padding: 5px 10px;
      border-radius: 4px;
      margin: 5px 0;
      font-size: 0.9em;
      display: inline-block;
    }
    .progress-info {
      color: #0066cc;
      font-weight: 500;
    }
    input[type="file"] {
      margin-bottom: 10px;
      padding: 5px;
    }
    h2, h3 {
      color: #333;
    }
    #downloadLink {
      display: block;
      margin: 10px 0;
      padding: 8px 12px;
      background: #28a745;
      color: white;
      text-decoration: none;
      border-radius: 4px;
      text-align: center;
      max-width: 200px;
    }
    #downloadLink:hover {
      background: #218838;
    }
    .file-size-warning {
      background: #fff3cd;
      color: #856404;
      padding: 8px;
      border-radius: 4px;
      margin: 10px 0;
      border: 1px solid #ffeaa7;
    }
  </style>
</head>
<body>
  <h2>Storj Upload & Download - Small & Large Files</h2>
  
  <div>
    <input type="file" id="fileInput" />
    <div id="fileInfo" class="upload-method" style="display: none;"></div>
    <div id="fileSizeWarning" class="file-size-warning" style="display: none;"></div>
  </div>
  
  <div>
    <button onclick="uploadFile()" class="upload-btn" id="uploadBtn">Smart Upload</button>
    <button onclick="cancelUpload()" class="cancel-btn" id="cancelBtn" style="display:none;">Cancel Upload</button>
    <button onclick="getDownloadLink()">Get Download Link</button>
    <button onclick="listFiles()">Refresh File List</button>
  </div>
  
  <div id="status"></div>
  <a id="downloadLink" href="#" target="_blank" style="display:none">Download File</a>
  
  <h3>Stored Files:</h3>
  <div id="fileList"></div>
  
  <h3>Response Details:</h3>
  <pre id="raw"></pre>

  <script>
    const API_BASE = "/api/file"; 
    const STREAM_API = "/api/upload-stream";
    const statusEl = document.getElementById("status");
    const rawEl = document.getElementById("raw");
    const downloadLinkEl = document.getElementById("downloadLink");
    const fileInput = document.getElementById("fileInput");
    const fileListEl = document.getElementById("fileList");
    const fileInfoEl = document.getElementById("fileInfo");
    const fileSizeWarningEl = document.getElementById("fileSizeWarning");
    const uploadBtnEl = document.getElementById("uploadBtn");
    const cancelBtnEl = document.getElementById("cancelBtn");
    
    let selectedFile = null;
    let uploadController = null;

    fileInput.addEventListener("change", (e) => {
      selectedFile = e.target.files[0];
      if (selectedFile) {
        const sizeMB = (selectedFile.size / (1024 * 1024)).toFixed(2);
        const uploadMethod = selectedFile.size > 4 * 1024 * 1024 ? "streaming (large file)" : "standard (small file)";
        const methodColor = selectedFile.size > 4 * 1024 * 1024 ? "#ff9800" : "#4caf50";
        
        fileInfoEl.style.display = "block";
        fileInfoEl.style.borderLeft = `4px solid ${methodColor}`;
        fileInfoEl.innerHTML = `
          <strong>${selectedFile.name}</strong><br>
          Size: ${formatFileSize(selectedFile.size)} (${sizeMB}MB)<br>
          Upload method: <span style="color: ${methodColor};">${uploadMethod}</span>
        `;
        
        // Show warning for very large files
        if (selectedFile.size > 50 * 1024 * 1024) { // 50MB
          fileSizeWarningEl.style.display = "block";
          fileSizeWarningEl.innerHTML = `
            <strong>⚠️ Large File Warning:</strong> File is ${sizeMB}MB. 
            Large uploads may take several minutes and could timeout on slower connections.
          `;
        } else {
          fileSizeWarningEl.style.display = "none";
        }
        
        setStatus(`Ready to upload: ${selectedFile.name}`, "info");
      }
    });

    function formatFileSize(bytes) {
      if (bytes === 0) return '0 Bytes';
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    function setStatus(msg, type = "info") {
      statusEl.textContent = msg;
      statusEl.className = type;
    }

    function showUploadControls(uploading) {
      uploadBtnEl.disabled = uploading;
      cancelBtnEl.style.display = uploading ? 'inline-block' : 'none';
    }

    function cancelUpload() {
      if (uploadController) {
        uploadController.abort();
        setStatus('Cancelling upload...', 'info');
        showUploadControls(false);
      }
    }

    // Smart upload function that routes based on file size
    async function uploadFile() {
      if (!selectedFile) {
        alert("Select a file first!");
        return;
      }

      const fileSize = selectedFile.size;
      const fileSizeMB = (fileSize / (1024 * 1024)).toFixed(2);

      // Add size validation
      if (fileSize > 100 * 1024 * 1024) { // 100MB limit
        alert(`File too large (${fileSizeMB}MB). Maximum size is 100MB.`);
        return;
      }

      if (fileSize === 0) {
        alert("Cannot upload empty file.");
        return;
      }

      showUploadControls(true);

      // Route based on file size
      if (fileSize > 4 * 1024 * 1024) { // Files larger than 4MB
        setStatus(`Large file detected (${fileSizeMB}MB). Using streaming upload...`, "loading");
        await uploadLargeFile(selectedFile);
      } else {
        setStatus(`Small file (${fileSizeMB}MB). Using standard upload...`, "loading");
        await uploadSmallFile(selectedFile);
      }
    }

    // Large file upload using streaming API
    async function uploadLargeFile(file) {
      downloadLinkEl.style.display = "none";
      rawEl.textContent = "";

      // Create abort controller for cancellation
      uploadController = new AbortController();

      try {
        const formData = new FormData();
        formData.append("file", file);

        setStatus("Initiating streaming upload...", "loading");

        const response = await fetch(STREAM_API, {
          method: "POST",
          body: formData,
          signal: uploadController.signal
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        // Handle streaming response with timeout
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let result = '';
        let lastProgressTime = Date.now();

        setStatus("Connected to streaming endpoint. Starting upload...", "loading");

        while (true) {
          // Add timeout for reading chunks
          const readPromise = reader.read();
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Stream timeout - no data received for 30 seconds')), 30000)
          );

          const { done, value } = await Promise.race([readPromise, timeoutPromise]);
          
          if (done) break;
          
          const chunk = decoder.decode(value);
          result += chunk;
          lastProgressTime = Date.now();
          
          // Update status with streaming progress
          const lines = chunk.split('\n').filter(line => line.trim());
          for (const line of lines) {
            console.log('Stream:', line);
            
            if (line.includes('Progress:')) {
              const progressMatch = line.match(/Progress: (\d+)%/);
              if (progressMatch) {
                const percent = progressMatch[1];
                setStatus(`🔄 Uploading: ${percent}% complete`, "loading");
              }
            } else if (line.includes('Upload completed:')) {
              setStatus(`✅ Large file upload successful!`, "success");
            } else if (line.includes('Error:')) {
              setStatus(`❌ ${line}`, "error");
              break;
            } else if (line.includes('Starting upload:')) {
              setStatus(`📤 ${line}`, "loading");
            } else if (line.includes('File size:')) {
              setStatus(`📊 ${line}`, "loading");
            }
          }
        }

        rawEl.textContent = result;
        
        if (result.includes('Upload completed:')) {
          setTimeout(listFiles, 1500);
        } else if (!result.includes('Error:')) {
          setStatus(`⚠️ Upload may have completed but no confirmation received`, "info");
          setTimeout(listFiles, 2000);
        }
        
      } catch (err) {
        if (err.name === 'AbortError') {
          setStatus('Upload cancelled by user', 'info');
          rawEl.textContent = 'Upload was cancelled by user.';
        } else {
          console.error('Large file upload error:', err);
          setStatus(`Large file upload failed: ${err.message}`, "error");
          rawEl.textContent = `Error: ${err.message}\nStack: ${err.stack}`;
        }
      } finally {
        uploadController = null;
        showUploadControls(false);
      }
    }

    // Small file upload using standard API
    async function uploadSmallFile(file) {
      downloadLinkEl.style.display = "none";
      rawEl.textContent = "";

      try {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch(API_BASE, {
          method: "POST",
          body: formData,
        });

        const contentType = res.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          const textResponse = await res.text();
          rawEl.textContent = textResponse;
          setStatus(`Server returned non-JSON response (${res.status})`, "error");
          return;
        }

        const json = await res.json();
        rawEl.textContent = JSON.stringify(json, null, 2);

        if (!res.ok) {
          setStatus(`Upload failed: ${json.details || json.error} (${res.status})`, "error");
          return;
        }

        setStatus(`✅ Upload successful! File: ${json.fileName}`, "success");
        setTimeout(listFiles, 1000);
        
      } catch (err) {
        console.error('Small file upload error:', err);
        setStatus(`Upload failed: ${err.message}`, "error");
        rawEl.textContent = `Error: ${err.message}`;
      } finally {
        showUploadControls(false);
      }
    }

    async function getDownloadLink() {
      if (!selectedFile) {
        alert("Upload a file first or select a file from the list!");
        return;
      }

      setStatus("Requesting download URL...", "loading");
      downloadLinkEl.style.display = "none";

      try {
        const res = await fetch(
          `${API_BASE}?action=download&filename=${encodeURIComponent(selectedFile.name)}`
        );

        const json = await res.json();
        rawEl.textContent = JSON.stringify(json, null, 2);

        if (!res.ok) {
          setStatus(`Failed to get download URL: ${json.details || json.error} (${res.status})`, "error");
          return;
        }

        const downloadUrl = json.downloadUrl;
        if (!downloadUrl) {
          setStatus("No downloadUrl returned", "error");
          return;
        }

        setStatus("✅ Download URL ready!", "success");
        downloadLinkEl.href = downloadUrl;
        downloadLinkEl.textContent = `Download ${selectedFile.name}`;
        downloadLinkEl.style.display = "inline-block";
        
      } catch (err) {
        console.error('Download error:', err);
        setStatus(`Download failed: ${err.message}`, "error");
        rawEl.textContent = String(err);
      }
    }

    // Direct download function for file list
    async function downloadFile(fileName) {
      setStatus(`Downloading ${fileName}...`, "loading");
      
      try {
        const res = await fetch(
          `${API_BASE}?action=download&filename=${encodeURIComponent(fileName)}`
        );

        const json = await res.json();

        if (!res.ok) {
          setStatus(`Download failed: ${json.details || json.error}`, "error");
          return;
        }

        if (json.downloadUrl) {
          setStatus(`✅ Downloading ${fileName}`, "success");
          window.open(json.downloadUrl, '_blank');
        } else {
          setStatus("No download URL received", "error");
        }
        
      } catch (err) {
        console.error('Download error:', err);
        setStatus(`Download failed: ${err.message}`, "error");
      }
    }

    async function listFiles() {
      setStatus("Fetching file list...", "loading");
      fileListEl.innerHTML = "";

      try {
        const res = await fetch(`${API_BASE}?action=list`);
        const json = await res.json();
        rawEl.textContent = JSON.stringify(json, null, 2);

        if (!res.ok) {
          setStatus(`Failed to fetch file list: ${json.details || json.error} (${res.status})`, "error");
          return;
        }

        if (!json.files || json.files.length === 0) {
          setStatus("No files found in bucket.", "info");
          fileListEl.innerHTML = '<p style="color: #666; font-style: italic;">No files uploaded yet. Upload your first file above!</p>';
          return;
        }

        setStatus(`✅ Found ${json.files.length} files:`, "success");
        
        json.files.forEach(file => {
          const fileDiv = document.createElement("div");
          fileDiv.className = "file-item";
          
          const fileName = document.createElement("span");
          fileName.className = "file-name";
          fileName.textContent = file.name;
          
          const selectBtn = document.createElement("button");
          selectBtn.textContent = "Select";
          selectBtn.onclick = () => {
            selectedFile = { name: file.name };
            setStatus(`Selected for download: ${file.name}`, "info");
            fileInfoEl.style.display = "block";
            fileInfoEl.style.borderLeft = "4px solid #17a2b8";
            fileInfoEl.innerHTML = `<strong>Selected from storage:</strong> ${file.name}`;
            fileSizeWarningEl.style.display = "none";
          };
          
          const downloadBtn = document.createElement("button");
          downloadBtn.textContent = "Download";
          downloadBtn.className = "upload-btn";
          downloadBtn.onclick = () => downloadFile(file.name);
          
          fileDiv.appendChild(fileName);
          fileDiv.appendChild(selectBtn);
          fileDiv.appendChild(downloadBtn);
          fileListEl.appendChild(fileDiv);
        });
        
      } catch (err) {
        console.error('List error:', err);
        setStatus(`Listing failed: ${err.message}`, "error");
        rawEl.textContent = String(err);
      }
    }

    // Auto-load file list on page load
    window.onload = function() {
      setStatus("Welcome! Loading your files...", "loading");
      listFiles();
    };
  </script>
</body>
</html>
