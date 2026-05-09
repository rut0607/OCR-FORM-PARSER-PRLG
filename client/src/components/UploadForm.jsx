export default function UploadForm({
  onFileChange,
  onSubmit,
  loading,
}) {
  return (
    <div>
      <input
        type="file"
        accept="image/jpeg"
        onChange={onFileChange}
      />

      <button
        onClick={onSubmit}
        disabled={loading}
      >
        {loading
          ? "Processing..."
          : "Upload"}
      </button>
    </div>
  );
}
