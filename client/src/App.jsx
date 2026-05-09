import { useState } from "react";
import axios from "axios";

import UploadForm from "./components/UploadForm";
import ResultTable from "./components/ResultTable";

const API_BASE = "http://localhost:3001";

export default function App() {
  const [file, setFile] = useState(null);

  const [loading, setLoading] =
    useState(false);

  const [entries, setEntries] =
    useState([]);

  const [error, setError] =
    useState("");

  function handleFileChange(e) {
    setFile(e.target.files[0]);
  }

  async function handleSubmit() {
    if (!file) return;

    setLoading(true);
    setError("");

    const formData = new FormData();

    formData.append("image", file);

    try {
      const res = await axios.post(
        `${API_BASE}/api/upload`,
        formData,
        {
          headers: {
            "Content-Type":
              "multipart/form-data",
          },
        }
      );

      setEntries(res.data.entries);
    } catch (err) {
      setError(
        err.response?.data?.error ||
          err.message
      );
    }

    setLoading(false);
  }

  return (
    <div className="container">
      <h1>Logbook Parser</h1>

      <UploadForm
        onFileChange={handleFileChange}
        onSubmit={handleSubmit}
        loading={loading}
      />

      {error && (
        <p style={{ color: "red" }}>
          {error}
        </p>
      )}

      <ResultTable entries={entries} />
    </div>
  );
}
