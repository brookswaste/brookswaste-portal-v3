import React, { useRef } from 'react';
import SignatureCanvas from 'react-signature-canvas';

const SignaturePad = ({ onSave }) => {
  const sigRef = useRef();

  const handleClear = () => {
    sigRef.current.clear();
  };

  const handleSave = () => {
    if (sigRef.current.isEmpty()) {
      alert("Please provide a signature first.");
      return;
    }
    const signature = sigRef.current.getTrimmedCanvas().toDataURL("image/png");
    onSave(signature); // callback to parent
  };

  return (
    <div className="bg-white p-4 rounded-xl shadow-md w-full max-w-md">
      <SignatureCanvas
        ref={sigRef}
        penColor="black"
        canvasProps={{ className: "border w-full h-40 rounded-lg bg-gray-100" }}
      />
      <div className="flex justify-between mt-2">
        <button
          onClick={handleClear}
          className="px-4 py-1 text-sm bg-gray-300 rounded hover:bg-gray-400"
        >
          Clear
        </button>
        <button
          onClick={handleSave}
          className="px-4 py-1 text-sm bg-pink-500 text-white rounded hover:bg-pink-600"
        >
          Save Signature
        </button>
      </div>
    </div>
  );
};

export default SignaturePad;
