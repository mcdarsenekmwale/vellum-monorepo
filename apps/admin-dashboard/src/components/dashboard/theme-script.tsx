// Inline script to set the theme class BEFORE hydration to avoid a flash.
export function ThemeScript() {
  const code = `(function(){try{var t=localStorage.getItem('nova-theme');var d=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;if(d)document.documentElement.classList.add('dark');}catch(e){}})();`;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
