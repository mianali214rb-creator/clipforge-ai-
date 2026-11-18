import React, { useState, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import './style.css';

const ffmpeg = new FFmpeg();
const CORE_CDN = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
function getYoutubeId(url) {
  try { const u = new URL(url); if (u.hostname.includes('youtu.be')) return u.pathname.slice(1); if (u.hostname.includes('youtube.com')) return u.searchParams.get('v') || u.pathname.split('/').filter(Boolean).pop(); } catch {} return '';
}
function App() {
  const [url, setUrl] = useState(''); const [file, setFile] = useState(null); const [duration, setDuration] = useState(0);
  const [start, setStart] = useState('0'); const [end, setEnd] = useState('30'); const [loading, setLoading] = useState(false); const [status, setStatus] = useState(''); const [output, setOutput] = useState(''); const [title, setTitle] = useState('My YouTube Short'); const [desc, setDesc] = useState('Created with ClipForge AI'); const [privacy, setPrivacy] = useState('private'); const [oauthClient, setOauthClient] = useState(localStorage.getItem('cf_oauth') || '');
  const videoRef = useRef(null); const fileInput = useRef(null);
  const id = getYoutubeId(url);
  const format = (s) => `${Math.floor(Number(s)/60).toString().padStart(2,'0')}:${Math.floor(Number(s)%60).toString().padStart(2,'0')}`;
  function onFile(f) { if (!f) return; setFile(f); setOutput(''); setStatus(''); setStart('0'); setEnd('30'); }
  function onMeta() { const d=videoRef.current?.duration || 0; setDuration(d); setEnd(String(Math.min(30, Math.floor(d)||30))); }
  async function exportClip() {
    if (!file) { setStatus('Upload your own video file first. A YouTube link can preview a source, but this tool does not extract/download YouTube videos.'); return; }
    const a=Number(start), b=Number(end); if (!(a>=0 && b>a && b<=duration+0.2)) { setStatus(`Choose valid times between 0 and ${Math.round(duration)} seconds.`); return; }
    setLoading(true); setStatus('Preparing video engine…'); setOutput('');
    try {
      if (!ffmpeg.loaded) { await ffmpeg.load({coreURL: await toBlobURL(`${CORE_CDN}/ffmpeg-core.js`,'text/javascript'), wasmURL: await toBlobURL(`${CORE_CDN}/ffmpeg-core.wasm`,'application/wasm')}); }
      ffmpeg.on('progress', ({progress}) => setStatus(`Rendering clip… ${Math.max(0,Math.min(100,Math.round(progress*100)))}%`));
      const inName='input-video'; const outName='clipforge-output.mp4'; await ffmpeg.writeFile(inName, await fetchFile(file));
      await ffmpeg.exec(['-ss',String(a),'-i',inName,'-t',String(b-a),'-vf','scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920','-c:v','libx264','-preset','ultrafast','-crf','24','-c:a','aac','-b:a','128k','-movflags','faststart',outName]);
      const data=await ffmpeg.readFile(outName); const blob=new Blob([data.buffer],{type:'video/mp4'}); const objectURL=URL.createObjectURL(blob); setOutput(objectURL); setStatus('Clip ready. Preview it and download.');
    } catch(e) { console.error(e); setStatus('Render failed. Try a smaller/shorter video or another browser. '+(e?.message||'')); }
    finally { setLoading(false); }
  }
  function download() { if (!output) return; const a=document.createElement('a'); a.href=output; a.download='clipforge-short.mp4'; a.click(); }
  function saveClient(){localStorage.setItem('cf_oauth',oauthClient.trim());setStatus('OAuth Client ID saved in this browser. Next, authorize your YouTube account when uploading.');}
  async function youtubeUpload(){
    if (!output) {setStatus('Render a clip first.');return;} if(!oauthClient.trim()){setStatus('Enter and save your Google OAuth Client ID first.');return;}
    if(!window.google?.accounts?.oauth2){setStatus('Loading Google sign-in… please wait a few seconds and try again.'); const script=document.createElement('script'); script.src='https://accounts.google.com/gsi/client'; script.onload=()=>setStatus('Google sign-in loaded. Press Upload to YouTube again.'); script.onerror=()=>setStatus('Could not load Google sign-in script. Check internet connection.'); document.head.appendChild(script); return;}
    setLoading(true); setStatus('Requesting Google authorization…');
    try {
      const tokenClient=window.google.accounts.oauth2.initTokenClient({client_id:oauthClient.trim(),scope:'https://www.googleapis.com/auth/youtube.upload',callback:async (tokenResponse)=>{
        if(tokenResponse.error){setStatus('Google authorization failed: '+tokenResponse.error);setLoading(false);return;}
        try{
          const blob=await fetch(output).then(r=>r.blob()); const metadata={snippet:{title:title.slice(0,100),description:desc,categoryId:'22'},status:{privacyStatus:privacy}};
          setStatus('Starting YouTube upload…');
          const init=await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',{method:'POST',headers:{Authorization:`Bearer ${tokenResponse.access_token}`,'Content-Type':'application/json; charset=UTF-8','X-Upload-Content-Type':'video/mp4','X-Upload-Content-Length':String(blob.size)},body:JSON.stringify(metadata)});
          if(!init.ok)throw new Error(await init.text()); const uploadUrl=init.headers.get('Location'); if(!uploadUrl)throw new Error('Upload URL missing from YouTube response.');
          const uploaded=await fetch(uploadUrl,{method:'PUT',headers:{Authorization:`Bearer ${tokenResponse.access_token}`,'Content-Type':'video/mp4'},body:blob});
          if(!uploaded.ok)throw new Error(await uploaded.text()); const video=await uploaded.json(); setStatus(`Upload successful! YouTube video ID: ${video.id} — https://youtu.be/${video.id}`);
        }catch(err){console.error(err);setStatus('Upload failed: '+(err.message||'Check YouTube API/OAuth configuration and video file.'));} finally{setLoading(false);}
      }}); tokenClient.requestAccessToken({prompt:'consent'});
    }catch(err){setLoading(false);setStatus('Could not start Google authorization: '+(err.message||''));}
  }
  return <div className="shell"><header className="top"><div className="brand"><div className="logo">✦</div><div><b>ClipForge <span>AI</span></b><small>SHORTS STUDIO</small></div></div><span className="pill">BETA · FREE START</span></header>
    <main><section className="hero"><div className="eyebrow">YOUR VIDEO → VIRAL-READY SHORTS</div><h1>Turn long videos into<br/><em>short moments.</em></h1><p>Preview a YouTube source, upload your video, trim a highlight and export a vertical Short.</p></section>
    <section className="card source"><div className="cardhead"><span className="step">01</span><div><h2>Video source</h2><p>Paste a YouTube URL for preview, or upload a video you own/have permission to edit.</p></div></div><div className="urlrow"><input value={url} onChange={e=>setUrl(e.target.value)} placeholder="Paste YouTube link here…"/><button className="btn secondary" onClick={()=>{if(!id)setStatus('Enter a valid YouTube video URL.')}}>Preview link</button></div>{id&&<div className="ytpreview"><iframe title="YouTube preview" src={`https://www.youtube.com/embed/${id}`} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen/></div>}<div className="uploadbox" onClick={()=>fileInput.current?.click()}><div className="uploadicon">↑</div><b>{file?file.name:'Upload your video file'}</b><span>{file?`${(file.size/1024/1024).toFixed(1)} MB · Click to change`:'MP4, MOV, WebM · Processed in your browser'}</span><input ref={fileInput} type="file" accept="video/*" hidden onChange={e=>onFile(e.target.files?.[0])}/></div>{file&&<video className="filepreview" ref={videoRef} src={URL.createObjectURL(file)} controls onLoadedMetadata={onMeta}/> }</section>
    <section className="card"><div className="cardhead"><span className="step">02</span><div><h2>Make your clip</h2><p>Choose a segment and export it as a vertical 9:16 Short.</p></div></div><div className="timegrid"><label>Start time (seconds)<input type="number" min="0" step="1" value={start} onChange={e=>setStart(e.target.value)}/></label><label>End time (seconds)<input type="number" min="1" step="1" value={end} onChange={e=>setEnd(e.target.value)}/></label></div>{duration>0&&<p className="hint">Video duration: {format(duration)} ({Math.floor(duration)} sec)</p>}<div className="presetrow">{[30,60,90].map(n=><button key={n} className="preset" onClick={()=>setEnd(String(Math.min(n,duration||n)))}>{n}s clip</button>)}</div><button className="btn primary full" onClick={exportClip} disabled={loading}>{loading?'Rendering…':'✦  Render vertical Short'}</button>{status&&<div className="status">{status}</div>}{output&&<div className="result"><h3>✓ Export ready</h3><video src={output} controls/><button className="btn primary full" onClick={download}>↓ Download MP4</button></div>}</section>
    <section className="card"><div className="cardhead"><span className="step">03</span><div><h2>YouTube upload setup</h2><p>Direct upload needs a Google Cloud OAuth Client ID and YouTube Data API enabled. This setup saves your client ID locally.</p></div></div><label className="wideLabel">Google OAuth Client ID<input value={oauthClient} onChange={e=>setOauthClient(e.target.value)} placeholder="xxxx.apps.googleusercontent.com"/></label><button className="btn secondary full" onClick={saveClient}>Save client ID</button><div className="ytfields"><label>Video title<input value={title} onChange={e=>setTitle(e.target.value)}/></label><label>Description<textarea value={desc} onChange={e=>setDesc(e.target.value)}/></label><label>Visibility<select value={privacy} onChange={e=>setPrivacy(e.target.value)}><option value="private">Private</option><option value="unlisted">Unlisted</option><option value="public">Public</option></select></label></div><button className="btn youtube full" onClick={youtubeUpload} disabled={loading}>{loading?'Uploading…':'▶ Upload to YouTube'}</button><div className="note">Upload is connected through YouTube Data API OAuth after you configure your Google Cloud Client ID. Videos upload using your account and selected privacy setting.</div></section>
    <footer>ClipForge AI · Free starter · Video processing runs in your browser. Use videos you own or have permission to edit.</footer></main></div>
}
createRoot(document.getElementById('root')).render(<App/>);
