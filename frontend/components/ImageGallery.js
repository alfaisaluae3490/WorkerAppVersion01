// frontend/components/ImageGallery.js
import { useState } from 'react';
import { 
  FiX, 
  FiChevronLeft, 
  FiChevronRight, 
  FiZoomIn, 
  FiZoomOut,
  FiMaximize2,
  FiDownload
} from 'react-icons/fi';

export default function ImageGallery({ images = [] }) {
  const [selectedImage, setSelectedImage] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  if (!images || images.length === 0) {
    return null;
  }

  const handlePrevious = () => {
    setSelectedImage((prev) => (prev === 0 ? images.length - 1 : prev - 1));
    resetZoom();
  };

  const handleNext = () => {
    setSelectedImage((prev) => (prev === images.length - 1 ? 0 : prev + 1));
    resetZoom();
  };

  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(prev + 0.5, 3));
  };

  const handleZoomOut = () => {
    setZoomLevel((prev) => Math.max(prev - 0.5, 1));
    if (zoomLevel <= 1.5) {
      setPosition({ x: 0, y: 0 });
    }
  };

  const resetZoom = () => {
    setZoomLevel(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleMouseDown = (e) => {
    if (zoomLevel > 1) {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      });
    }
  };

  const handleMouseMove = (e) => {
    if (isDragging && zoomLevel > 1) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const openLightbox = (index) => {
    setSelectedImage(index);
    setIsLightboxOpen(true);
    resetZoom();
  };

  const closeLightbox = () => {
    setIsLightboxOpen(false);
    resetZoom();
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = images[selectedImage];
    link.download = `job-image-${selectedImage + 1}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <>
      <div className="card">
        <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center justify-between">
          <span>Job Images ({images.length})</span>
          <button
            onClick={() => openLightbox(selectedImage)}
            className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
          >
            <FiMaximize2 size={16} />
            View Fullscreen
          </button>
        </h2>

        {/* Main Image Preview */}
        <div className="mb-4 rounded-lg overflow-hidden bg-gray-100 relative group">
          <img
            src={images[selectedImage]}
            alt={`Job image ${selectedImage + 1}`}
            onClick={() => openLightbox(selectedImage)}
            className="w-full h-96 object-contain cursor-pointer transition-transform hover:scale-105"
          />
          
          {/* Hover Overlay */}
          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all flex items-center justify-center">
            <button
              onClick={() => openLightbox(selectedImage)}
              className="opacity-0 group-hover:opacity-100 transition-opacity bg-white rounded-full p-3 shadow-lg"
            >
              <FiMaximize2 size={24} className="text-gray-700" />
            </button>
          </div>

          {/* Navigation Arrows for Main Image */}
          {images.length > 1 && (
            <>
              <button
                onClick={handlePrevious}
                className="absolute left-2 top-1/2 -translate-y-1/2 bg-white bg-opacity-90 hover:bg-opacity-100 rounded-full p-2 shadow-lg transition opacity-0 group-hover:opacity-100"
              >
                <FiChevronLeft size={24} />
              </button>
              <button
                onClick={handleNext}
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-white bg-opacity-90 hover:bg-opacity-100 rounded-full p-2 shadow-lg transition opacity-0 group-hover:opacity-100"
              >
                <FiChevronRight size={24} />
              </button>
            </>
          )}

          {/* Image Counter */}
          <div className="absolute bottom-4 right-4 bg-black bg-opacity-60 text-white px-3 py-1 rounded-full text-sm">
            {selectedImage + 1} / {images.length}
          </div>
        </div>

        {/* Thumbnail Gallery */}
        {images.length > 1 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2">
            {images.map((image, index) => (
              <button
                key={index}
                onClick={() => setSelectedImage(index)}
                className={`rounded-lg overflow-hidden border-2 transition ${
                  selectedImage === index
                    ? 'border-primary-600 ring-2 ring-primary-200'
                    : 'border-gray-200 hover:border-gray-400'
                }`}
              >
                <img
                  src={image}
                  alt={`Thumbnail ${index + 1}`}
                  className="w-full h-20 object-cover"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox Modal */}
      {isLightboxOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-95 z-50 flex items-center justify-center"
          onClick={closeLightbox}
        >
          {/* Close Button */}
          <button
            onClick={closeLightbox}
            className="absolute top-4 right-4 bg-white bg-opacity-20 hover:bg-opacity-30 text-white rounded-full p-3 transition z-50"
          >
            <FiX size={24} />
          </button>

          {/* Controls Bar */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white bg-opacity-20 backdrop-blur-sm rounded-full px-6 py-3 flex items-center gap-4 z-50">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleZoomOut();
              }}
              disabled={zoomLevel <= 1}
              className="text-white hover:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FiZoomOut size={20} />
            </button>
            
            <span className="text-white text-sm font-medium min-w-[60px] text-center">
              {Math.round(zoomLevel * 100)}%
            </span>
            
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleZoomIn();
              }}
              disabled={zoomLevel >= 3}
              className="text-white hover:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FiZoomIn size={20} />
            </button>

            <div className="w-px h-6 bg-white bg-opacity-30"></div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDownload();
              }}
              className="text-white hover:text-gray-200"
              title="Download image"
            >
              <FiDownload size={20} />
            </button>
          </div>

          {/* Image Counter */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-white bg-opacity-20 backdrop-blur-sm text-white px-4 py-2 rounded-full text-sm z-50">
            {selectedImage + 1} / {images.length}
          </div>

          {/* Previous Button */}
          {images.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handlePrevious();
              }}
              className="absolute left-4 top-1/2 -translate-y-1/2 bg-white bg-opacity-20 hover:bg-opacity-30 text-white rounded-full p-4 transition z-50"
            >
              <FiChevronLeft size={32} />
            </button>
          )}

          {/* Next Button */}
          {images.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleNext();
              }}
              className="absolute right-4 top-1/2 -translate-y-1/2 bg-white bg-opacity-20 hover:bg-opacity-30 text-white rounded-full p-4 transition z-50"
            >
              <FiChevronRight size={32} />
            </button>
          )}

          {/* Main Image with Zoom */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-w-[90vw] max-h-[90vh] overflow-hidden relative"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <img
              src={images[selectedImage]}
              alt={`Job image ${selectedImage + 1}`}
              className="max-w-full max-h-[90vh] object-contain transition-transform"
              style={{
                transform: `scale(${zoomLevel}) translate(${position.x / zoomLevel}px, ${position.y / zoomLevel}px)`,
                cursor: zoomLevel > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
              }}
              draggable={false}
            />
          </div>

          {/* Thumbnail Strip at Bottom */}
          {images.length > 1 && (
            <div className="absolute bottom-20 left-1/2 -translate-x-1/2 max-w-[80vw] overflow-x-auto">
              <div className="flex gap-2 px-4">
                {images.map((image, index) => (
                  <button
                    key={index}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedImage(index);
                      resetZoom();
                    }}
                    className={`flex-shrink-0 rounded-lg overflow-hidden border-2 transition ${
                      selectedImage === index
                        ? 'border-white ring-2 ring-white ring-opacity-50'
                        : 'border-transparent opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img
                      src={image}
                      alt={`Thumbnail ${index + 1}`}
                      className="w-16 h-16 object-cover"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}