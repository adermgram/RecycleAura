import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { API_BASE_URL, getAuthHeader } from '../config/api';

const QRScanner = () => {
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const scannerRef = useRef(null);
  const containerId = 'qr-scanner-fallback';

  useEffect(() => {
    if (isScanning) {
      const scanner = new Html5Qrcode(containerId);
      scannerRef.current = scanner;

      scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: 250 },
        async (decodedText) => {
          await scanner.stop();
          setIsScanning(false);

          try {
            const [itemId, type, points] = decodedText.split('|');
            const response = await axios.post(
              `${API_BASE_URL}/api/items/validate-qr`,
              { itemId, type, points: parseInt(points) },
              { headers: getAuthHeader() }
            );
            if (response.data.valid) {
              setScanResult({
                itemType: type,
                points: parseInt(points),
                totalPoints: response.data.totalPoints
              });
              toast.success(`Recycled ${type}! +${points} points`);
            }
          } catch (error) {
            toast.error(error.response?.data?.message || 'Error processing QR code');
          }
        },
        () => {}
      ).catch(() => {
        toast.error('Error accessing camera');
        setIsScanning(false);
      });
    }

    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, [isScanning]);

  return (
    <div className="qr-scanner-container">
      {!isScanning ? (
        <button
          onClick={() => setIsScanning(true)}
          className="btn btn-primary mb-3"
        >
          Scan QR Code
        </button>
      ) : (
        <div className="scanner-wrapper">
          <div id={containerId} style={{ width: '100%' }} />
          <button
            onClick={() => setIsScanning(false)}
            className="btn btn-secondary mt-3"
          >
            Cancel
          </button>
        </div>
      )}

      {scanResult && (
        <div className="scan-result mt-3">
          <h4>Scan Result</h4>
          <p>Item Type: {scanResult.itemType}</p>
          <p>Points Earned: {scanResult.points}</p>
          <p>Total Points: {scanResult.totalPoints}</p>
        </div>
      )}
    </div>
  );
};

export default QRScanner;
