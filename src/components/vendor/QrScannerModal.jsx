import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, X, AlertCircle, Scan, Keyboard, Upload, RefreshCw } from 'lucide-react';

// Pre-processes and downscales heavy mobile photos/screenshots to optimal scan resolution
const resizeImageForScanning = (file, maxDimension = 1000) => {
  return new Promise((resolve) => {
    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let { width, height } = img;
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);
            canvas.toBlob((blob) => {
              if (blob) {
                const resizedFile = new File([blob], 'qr-scan.png', { type: 'image/png' });
                resolve(resizedFile);
              } else {
                resolve(file);
              }
            }, 'image/png', 0.95);
          } else {
            resolve(file);
          }
        };
        img.onerror = () => resolve(file);
        img.src = e.target?.result;
      };
      reader.onerror = () => resolve(file);
      reader.readAsDataURL(file);
    } catch (e) {
      resolve(file);
    }
  });
};

export const QrScannerModal = ({ isOpen, onClose, onScanSuccess }) => {
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [manualCode, setManualCode] = useState('');
  const [isManualMode, setIsManualMode] = useState(false);
  const [isScanningFile, setIsScanningFile] = useState(false);
  const qrRegionId = 'html5qr-code-region';
  const html5QrCodeRef = useRef(null);
  const fileInputRef = useRef(null);
  const isProcessingRef = useRef(false);

  useEffect(() => {
    let isMounted = true;
    isProcessingRef.current = false;

    if (isOpen && !isManualMode) {
      // Delay camera initialization slightly to ensure DOM element is rendered
      const timer = setTimeout(() => {
        if (isMounted) startCamera();
      }, 250);
      return () => clearTimeout(timer);
    } else {
      stopCamera();
    }

    return () => {
      isMounted = false;
      stopCamera();
    };
  }, [isOpen, isManualMode]);

  const handleDecodedText = (decodedText) => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;
    stopCamera();
    onScanSuccess(decodedText);
  };

  const startCamera = async () => {
    setCameraError('');
    isProcessingRef.current = false;
    try {
      const element = document.getElementById(qrRegionId);
      if (!element) return;

      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode(qrRegionId, {
          experimentalFeatures: {
            useBarCodeDetectorIfSupported: true,
          }
        });
      }

      // Check available cameras
      let cameraIdOrConfig = { facingMode: 'environment' };
      try {
        const devices = await Html5Qrcode.getCameras();
        if (devices && devices.length > 0) {
          const backCamera = devices.find(d => d.label.toLowerCase().includes('back')) || devices[devices.length - 1];
          cameraIdOrConfig = backCamera.id;
        }
      } catch (e) {
        console.log('Camera enumeration fallback:', e);
      }

      const config = {
        fps: 20,
        qrbox: (viewfinderWidth, viewfinderHeight) => {
          const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
          return {
            width: Math.floor(minEdge * 0.85),
            height: Math.floor(minEdge * 0.85),
          };
        },
        aspectRatio: 1.0,
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true,
        },
      };

      await html5QrCodeRef.current.start(
        cameraIdOrConfig,
        config,
        (decodedText) => {
          handleDecodedText(decodedText);
        },
        () => {}
      );
      setCameraActive(true);
    } catch (err) {
      console.warn('Live camera initialization note:', err);
      try {
        if (html5QrCodeRef.current) {
          await html5QrCodeRef.current.start(
            { facingMode: 'user' },
            {
              fps: 20,
              qrbox: { width: 240, height: 240 },
              experimentalFeatures: { useBarCodeDetectorIfSupported: true }
            },
            (decodedText) => {
              handleDecodedText(decodedText);
            },
            () => {}
          );
          setCameraActive(true);
          return;
        }
      } catch (fallbackErr) {
        console.warn('Fallback camera note:', fallbackErr);
      }

      setCameraError('Camera access requires browser permission or HTTPS.');
      setCameraActive(false);
    }
  };

  const stopCamera = async () => {
    if (html5QrCodeRef.current) {
      try {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
        }
        html5QrCodeRef.current.clear();
      } catch (e) {
        console.log('Stop camera notice:', e);
      }
    }
    // Deep cleanup of any attached video stream tracks
    try {
      const regionEl = document.getElementById(qrRegionId);
      const videoEl = regionEl ? regionEl.querySelector('video') : null;
      if (videoEl && videoEl.srcObject && videoEl.srcObject.getTracks) {
        videoEl.srcObject.getTracks().forEach(track => {
          try { track.stop(); } catch (te) {}
        });
        videoEl.srcObject = null;
      }
    } catch (trackErr) {}

    setCameraActive(false);
  };

  // Multi-tier File Scan Engine (Native BarcodeDetector + Downscaled Canvas + Html5Qrcode)
  const handleFileScan = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsScanningFile(true);

      // Strategy 1: Hardware-Accelerated Native Browser BarcodeDetector (iOS & Android)
      if ('BarcodeDetector' in window) {
        try {
          const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
          const imageBitmap = typeof window.createImageBitmap === 'function' ? await window.createImageBitmap(file) : null;
          if (!imageBitmap) throw new Error('createImageBitmap not available');
          const barcodes = await detector.detect(imageBitmap);
          if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
            console.log('✅ Decoded with native BarcodeDetector:', barcodes[0].rawValue);
            stopCamera();
            onScanSuccess(barcodes[0].rawValue);
            return;
          }
        } catch (nativeErr) {
          console.log('Native BarcodeDetector pass note:', nativeErr);
        }
      }

      // Ensure Html5Qrcode instance
      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode(qrRegionId, {
          experimentalFeatures: { useBarCodeDetectorIfSupported: true }
        });
      }

      // Strategy 2: Pre-process & Downscale Image for optimal contrast & memory
      try {
        const optimizedFile = await resizeImageForScanning(file, 1000);
        const decodedText = await html5QrCodeRef.current.scanFile(optimizedFile, true);
        if (decodedText) {
          stopCamera();
          onScanSuccess(decodedText);
          return;
        }
      } catch (optErr) {
        console.log('Optimized scan note, falling back to raw:', optErr);
      }

      // Strategy 3: Raw image file scan fallback
      const rawDecodedText = await html5QrCodeRef.current.scanFile(file, true);
      stopCamera();
      onScanSuccess(rawDecodedText);

    } catch (err) {
      console.error('File scan error:', err);
      setCameraError('Could not decode QR code from this image. Please take a clearer photo or enter Order ID manually below.');
      setIsManualMode(true);
    } finally {
      setIsScanningFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    stopCamera();
    onScanSuccess(manualCode.trim());
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
      <div className="bg-[#111827] border border-gray-800 w-full max-w-md rounded-3xl p-5 sm:p-6 shadow-2xl relative text-gray-100 max-h-[90vh] overflow-y-auto">
        
        {/* Close Button */}
        <button
          onClick={() => {
            stopCamera();
            onClose();
          }}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white rounded-xl hover:bg-gray-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="text-center mb-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-950/70 text-orange-400 text-xs font-bold mb-1.5 border border-orange-800/60">
            <Scan className="w-3.5 h-3.5" />
            <span>Counter Barcode Scanner</span>
          </div>
          <h3 className="text-xl font-black text-white">Scan Pickup Pass</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Hold camera over student's order QR code
          </p>
        </div>

        {/* Viewfinder / Camera Element */}
        {!isManualMode && (
          <div className="space-y-3">
            <div className="relative overflow-hidden rounded-2xl bg-black border-2 border-orange-500/60 flex flex-col items-center justify-center min-h-[260px]">
              <div id={qrRegionId} className="w-full h-full min-h-[260px]" />
              
              {cameraError && (
                <div className="absolute inset-0 bg-[#111827] p-5 flex flex-col items-center justify-center text-center">
                  <AlertCircle className="w-8 h-8 text-orange-400 mx-auto mb-2" />
                  <p className="text-xs text-gray-300 mb-3 max-w-xs">{cameraError}</p>
                  
                  <div className="flex flex-col gap-2 w-full max-w-xs">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full py-2.5 px-4 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 shadow"
                    >
                      <Camera className="w-4 h-4" />
                      <span>Take Photo / Upload QR</span>
                    </button>

                    <button
                      onClick={() => setIsManualMode(true)}
                      className="w-full py-2.5 px-4 bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-semibold rounded-xl transition"
                    >
                      Enter Code Manually
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Photo / Camera Roll Alternative Scan */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isScanningFile}
                className="flex-1 py-2.5 px-3 bg-gray-800 hover:bg-gray-700 active:bg-gray-700 border border-gray-700 text-gray-200 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5"
              >
                {isScanningFile ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-orange-400" />
                ) : (
                  <Upload className="w-3.5 h-3.5 text-orange-400" />
                )}
                <span>{isScanningFile ? 'Scanning Image...' : 'Snap Photo / Select Image'}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsManualMode(true)}
                className="py-2.5 px-3 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-xs font-semibold transition flex items-center gap-1 border border-gray-700"
              >
                <Keyboard className="w-3.5 h-3.5 text-orange-400" />
                <span>Manual</span>
              </button>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              capture="environment"
              onChange={handleFileScan}
              className="hidden"
            />
          </div>
        )}

        {/* Manual Input Fallback */}
        {isManualMode && (
          <form onSubmit={handleManualSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                Enter Order ID or Token:
              </label>
              <input
                type="text"
                required
                placeholder="e.g. CB-7104 or CB-TOKEN-..."
                value={manualCode}
                onChange={e => setManualCode(e.target.value)}
                className="w-full px-4 py-3 bg-[#1F2937] border border-gray-700 rounded-xl text-white font-mono text-sm focus:border-orange-500 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 text-white font-bold rounded-xl text-xs transition active:scale-98 shadow-md shadow-orange-500/20"
            >
              Verify & Decode Order
            </button>
          </form>
        )}

        {/* Mode Toggle Button */}
        <div className="mt-4 pt-3 border-t border-gray-800 flex justify-between items-center text-xs">
          <button
            onClick={() => {
              setIsManualMode(!isManualMode);
              setCameraError('');
            }}
            className="text-orange-400 hover:text-orange-300 font-semibold flex items-center gap-1"
          >
            {isManualMode ? <Camera className="w-3.5 h-3.5" /> : <Keyboard className="w-3.5 h-3.5" />}
            <span>{isManualMode ? 'Switch to Camera' : 'Enter Code Manually'}</span>
          </button>

          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="text-gray-400 hover:text-white"
          >
            Cancel
          </button>
        </div>

      </div>
    </div>
  );
};
