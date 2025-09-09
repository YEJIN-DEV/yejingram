import type { FileToSend } from '../../entities/message/types';
import { StickyNote } from 'lucide-react';


export const renderFile = (file: FileToSend, preview: boolean) => {
  const { dataUrl, mimeType } = file;

  if (mimeType.startsWith('image/')) {
    return (
      <img
        src={dataUrl}
        className={`${preview ? "max-w-full max-h-32" : "max-w-64"} object-contain rounded-lg`}
        alt="미리보기"
      />
    );
  }

  if (mimeType.startsWith('audio/')) {
    return (
      <div className="w-64 bg-gradient-to-r from-purple-50 to-blue-50 p-4 rounded-lg border border-purple-200">
        <div className="flex items-center space-x-3 mb-3">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM15.657 6.343a1 1 0 011.414 0A9.972 9.972 0 0119 12a9.972 9.972 0 01-1.929 5.657 1 1 0 11-1.414-1.414A7.971 7.971 0 0017 12a7.971 7.971 0 00-1.343-4.243 1 1 0 010-1.414z" clipRule="evenodd" />
              <path fillRule="evenodd" d="M13.071 8.929a1 1 0 011.414 0A5.983 5.983 0 0116 12a5.983 5.983 0 01-1.515 3.071 1 1 0 11-1.414-1.414A3.983 3.983 0 0014 12a3.983 3.983 0 00-.929-2.657 1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-800">오디오 파일</p>
            <p className="text-xs text-gray-500">클릭하여 재생</p>
          </div>
        </div>
        <audio
          controls
          src={dataUrl}
          className="w-full h-8 rounded-md"
          style={{
            filter: 'sepia(20%) saturate(70%) hue-rotate(315deg) brightness(95%) contrast(105%)'
          }}
        />
      </div>
    );
  }

  if (mimeType.startsWith('video/')) {
    return (
      <video
        src={dataUrl}
        className="max-w-full max-h-32 object-contain rounded-lg cursor-pointer"
        onClick={(e) => {
          const video = e.currentTarget;
          if (video.paused) {
            video.play();
          } else {
            video.pause();
          }
        }}
      />
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-24 bg-gray-200 rounded-lg">
      <StickyNote className="w-8 h-8 text-gray-500" />
      <span className="text-sm text-gray-600 mt-1">
        {file.name ? (file.name.length > 14 ? file.name.slice(0, 14) + '...' : file.name) : 'File'}
      </span>
    </div>
  );
};