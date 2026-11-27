import { useEffect, useRef, useState } from 'react';
import { api } from './api.js';
import { imageUrl } from './format.js';
import { prepareMenuPhoto } from './resizeImage.js';

// Photo field for the dish editor: pick a photo, it is cropped square, resized and uploaded.
export function ImagePicker({ value, onChange, onBusyChange }) {
  const inputRef = useRef(null);
  const [status, setStatus] = useState('idle'); // idle | working
  const [error, setError] = useState('');
  const [localPreview, setLocalPreview] = useState('');

  // The editor can close while a photo is still being prepared or uploaded; ignore those late results.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => () => localPreview && URL.revokeObjectURL(localPreview), [localPreview]);
  useEffect(() => onBusyChange?.(status === 'working'), [status, onBusyChange]);

  const choose = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError('');
    setStatus('working');
    try {
      const { full, thumbnail } = await prepareMenuPhoto(file);
      if (!mounted.current) return;
      setLocalPreview(URL.createObjectURL(full));
      const { url } = await api.uploadPhoto(full, thumbnail);
      if (mounted.current) onChange(url);
    } catch (err) {
      if (!mounted.current) return;
      setLocalPreview('');
      setError(err.message);
    } finally {
      if (mounted.current) setStatus('idle');
    }
  };

  const preview = localPreview || imageUrl(value);

  return (
    <div className="image-picker">
      <span className="field-label">Photo</span>
      <div className="image-picker-row">
        <div className="image-frame">
          {preview ? <img src={preview} alt="" /> : <span className="muted">No photo</span>}
          {status === 'working' && <span className="image-busy">Uploading…</span>}
        </div>
        <div className="image-actions">
          <button type="button" className="secondary" disabled={status === 'working'} onClick={() => inputRef.current?.click()}>
            {value ? 'Change photo' : 'Upload photo'}
          </button>
          {value && status !== 'working' && (
            <button type="button" className="link" onClick={() => { setLocalPreview(''); onChange(''); }}>
              Remove photo
            </button>
          )}
          <small className="muted">Square photos look best. We crop to the centre and resize automatically.</small>
        </div>
      </div>
      <input ref={inputRef} type="file" accept="image/*" hidden onChange={choose} />
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  );
}
