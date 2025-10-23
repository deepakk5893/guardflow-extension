const f=[{id:"openai-api-key-user",type:"OpenAI API Key (User)",pattern:/\bsk-[A-Za-z0-9\-]{40,}\b/g,severity:"error",message:"OpenAI API Key detected"},{id:"openai-api-key-project",type:"OpenAI API Key (Project)",pattern:/\bsk-proj-[A-Za-z0-9\-_]{48,200}\b/g,severity:"error",message:"OpenAI Project API Key detected"},{id:"anthropic-api-key",type:"Anthropic API Key",pattern:/\bsk-ant-api\d{2}-[A-Za-z0-9\-_]{20,}\b/g,severity:"error",message:"Anthropic (Claude) API Key detected"},{id:"database-url",type:"Database URL",pattern:/(postgres|postgresql|mysql|mongodb|redis):\/\/[^:]*:[^@]+@[^\s]+/gi,severity:"error",message:"Database Connection String with credentials detected"},{id:"aws-access-key",type:"AWS Access Key",pattern:/['"]?(AKIA|ASIA|AIPA|AROA)[A-Z0-9]{16}['"]?/g,severity:"error",message:"AWS Access Key detected"},{id:"aws-secret-key",type:"AWS Secret Key",pattern:/aws[_-]?secret[_-]?access[_-]?key[_\"'\s:=]*([A-Za-z0-9/+=]{40})\b/gi,severity:"error",message:"AWS Secret Access Key detected"},{id:"github-pat",type:"GitHub Token",pattern:/\bghp_[A-Za-z0-9]{36,255}\b/g,severity:"error",message:"GitHub Personal Access Token detected"},{id:"github-oauth",type:"GitHub Token",pattern:/\bgho_[A-Za-z0-9]{36,255}\b/g,severity:"error",message:"GitHub OAuth Token detected"},{id:"github-user-to-server",type:"GitHub Token",pattern:/\bghu_[A-Za-z0-9]{36,255}\b/g,severity:"error",message:"GitHub User-to-Server Token detected"},{id:"github-server-to-server",type:"GitHub Token",pattern:/\bghs_[A-Za-z0-9]{36,255}\b/g,severity:"error",message:"GitHub Server-to-Server Token detected"},{id:"github-refresh",type:"GitHub Token",pattern:/\bghr_[A-Za-z0-9]{36,255}\b/g,severity:"error",message:"GitHub Refresh Token detected"},{id:"github-fine-grained-pat",type:"GitHub Fine-Grained Token",pattern:/\bgithub_pat_[A-Za-z0-9_]{82}\b/g,severity:"error",message:"GitHub Fine-Grained Personal Access Token detected"},{id:"stripe-key",type:"Stripe API Key",pattern:/\b(sk|pk)_(live|test)_[0-9a-zA-Z]{24,99}\b/g,severity:"error",message:"Stripe API Key detected"},{id:"sendgrid-key",type:"SendGrid API Key",pattern:/\bSG\.[A-Za-z0-9_\-]{16,32}\.[A-Za-z0-9_\-]{32,64}\b/g,severity:"error",message:"SendGrid API Key detected"},{id:"slack-token",type:"Slack Token",pattern:/xox[baprs]-[0-9]{10,13}-[0-9]{10,13}-[A-Za-z0-9]{24,32}/g,severity:"error",message:"Slack Token detected"},{id:"slack-webhook",type:"Slack Webhook",pattern:/https:\/\/hooks\.slack\.com\/services\/T[A-Z0-9]{6,}\/B[A-Z0-9]{6,}\/[A-Za-z0-9]{20,}/g,severity:"error",message:"Slack Webhook URL detected"},{id:"private-key",type:"Private Key",pattern:/-----BEGIN[A-Z ]*PRIVATE KEY-----/g,severity:"error",message:"Private Key detected"},{id:"ssh-private-key",type:"SSH Private Key",pattern:/-----BEGIN (RSA|DSA|EC|OPENSSH) PRIVATE KEY-----/g,severity:"error",message:"SSH Private Key detected"},{id:"jwt-token",type:"JWT Token",pattern:/\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,severity:"warning",message:"JWT Token detected"},{id:"basic-auth",type:"Basic Auth",pattern:/[a-zA-Z]{3,10}:\/\/[^:\/\s]{3,20}:[^@\/\s]{3,20}@/g,severity:"warning",message:"URL with Basic Authentication credentials detected"},{id:"password-assignment",type:"Password",pattern:/\b(password|passwd|pwd)[\s]*[=:]\s*["']([^"']{8,})["']/gi,severity:"warning",message:"Password in plain text detected"},{id:"google-api-key",type:"Google API Key",pattern:/\bAIza[0-9A-Za-z_\-]{35,}\b/g,severity:"error",message:"Google API Key detected (GCP/Gemini/Firebase)"},{id:"groq-api-key",type:"Groq API Key",pattern:/\bgsk_[A-Za-z0-9]{20,}\b/g,severity:"error",message:"Groq API Key detected"},{id:"huggingface-token",type:"Hugging Face Token",pattern:/\bhf_[A-Za-z0-9]{30,}\b/g,severity:"error",message:"Hugging Face API Token detected"},{id:"replicate-token",type:"Replicate API Token",pattern:/\br8_[A-Za-z0-9]{32,}\b/g,severity:"error",message:"Replicate API Token detected"},{id:"cohere-api-key",type:"Cohere API Key",pattern:/\bC[A-Za-z0-9]{20,}\b/g,severity:"error",message:"Cohere API Key detected"},{id:"mistral-api-key",type:"Mistral API Key",pattern:/\bmistral_[A-Za-z0-9\-_]{20,}\b/g,severity:"error",message:"Mistral API Key detected"},{id:"ollama-token",type:"Ollama Token",pattern:/\bollama_[A-Za-z0-9\-_]{20,}\b/g,severity:"warning",message:"Ollama API Token detected"},{id:"generic-api-key",type:"API Key",pattern:/\b(api[_-]?key|apikey|api[_-]?token|access[_-]?token)[\s:="']*([A-Za-z0-9_\-]{20,})\b/gi,severity:"warning",message:"Potential API Key detected"},{id:"npm-token",type:"NPM Token",pattern:/\bnpm_[A-Za-z0-9]{20,}\b/g,severity:"error",message:"NPM Access Token detected"},{id:"gitlab-pat",type:"GitLab Personal Access Token",pattern:/\bglpat-[A-Za-z0-9\-_]{20,}\b/g,severity:"error",message:"GitLab Personal Access Token detected"},{id:"bitbucket-password",type:"Bitbucket App Password",pattern:/\bbitbucket_[A-Za-z0-9\-_]{20,}\b/g,severity:"error",message:"Bitbucket App Password detected"},{id:"circleci-token",type:"CircleCI Token",pattern:/\bcircleci_[A-Za-z0-9\-_]{20,}\b/g,severity:"error",message:"CircleCI API Token detected"},{id:"terraform-token",type:"Terraform Cloud Token",pattern:/\batlasv1\.[A-Za-z0-9\-_]{20,}\b/g,severity:"error",message:"Terraform Cloud API Token detected"},{id:"pagerduty-token",type:"PagerDuty Token",pattern:/\bPD[a-zA-Z0-9]{18,}\b/g,severity:"error",message:"PagerDuty API Token detected"},{id:"azure-sas-token",type:"Azure Storage SAS Token",pattern:/sv=202[0-9]-[0-9]{2}-[0-9]{2}&ss=[a-z]&srt=[a-z]/gi,severity:"error",message:"Azure Storage SAS Token detected"},{id:"google-oauth-secret",type:"Google OAuth Client Secret",pattern:/"client_secret"\s*:\s*"[A-Za-z0-9\-_]{24,}"/g,severity:"error",message:"Google OAuth Client Secret detected"},{id:"twilio-api-key",type:"Twilio API Key",pattern:/\bSK[0-9a-fA-F]{32}\b/g,severity:"error",message:"Twilio API Key detected"},{id:"mailgun-api-key",type:"Mailgun API Key",pattern:/\bkey-[0-9a-fA-F]{32}\b/g,severity:"error",message:"Mailgun API Key detected"},{id:"cloudflare-token",type:"Cloudflare API Token",pattern:/\bCF[a-zA-Z0-9\-_]{20,}\b/g,severity:"error",message:"Cloudflare API Token detected"},{id:"heroku-api-key",type:"Heroku API Key",pattern:/\bheroku_[A-Za-z0-9\-_]{20,}\b/g,severity:"error",message:"Heroku API Key detected"},{id:"digitalocean-token",type:"DigitalOcean Token",pattern:/\bdop_v1_[A-Za-z0-9]{50,}\b/g,severity:"error",message:"DigitalOcean API Token detected"},{id:"docker-registry-token",type:"Docker Registry Token",pattern:/\bdckr_pat_[A-Za-z0-9_\-]{20,}\b/g,severity:"error",message:"Docker Registry Personal Access Token detected"}],w=(e,o,r)=>{const t=e.substring(o,o+r),a=Math.min(6,Math.floor(r*.3)),n=t.substring(0,a),s="█".repeat(Math.min(16,r-a));return`${n}${s}`},k=(e,o)=>{if(o.id==="generic-api-key"){const r=e.toLowerCase();if(r.includes("example")||r.includes("your_")||r.includes("your-")||r.includes("placeholder")||r.includes("xxxxxxx")||r.includes("*******")||/^[x*]+$/i.test(e))return!0}return!1};async function x(e){if(!e||e.trim().length===0)return{hasSecrets:!1,secrets:[],count:0};const o=[],r=new Set;try{for(const t of f){t.pattern.lastIndex=0;let a;for(;(a=t.pattern.exec(e))!==null;){const n=a[0],s=a.index,d=`${t.id}:${s}:${n}`;r.has(d)||k(n,t)||(r.add(d),o.push({type:t.type,index:s,length:n.length,severity:t.severity,message:t.message,ruleId:t.id,preview:w(e,s,n.length)}))}}return o.sort((t,a)=>t.index-a.index),{hasSecrets:o.length>0,secrets:o,count:o.length}}catch(t){return console.error("Error detecting secrets:",t),{hasSecrets:!1,secrets:[],count:0}}}function v(e,o){return(e.substring(0,o.index).match(/\n/g)||[]).length+1}const A={"chat.openai.com":{name:"ChatGPT",textarea:"#prompt-textarea",submitButton:'button[data-testid="send-button"], button[data-testid="fruitjuice-send-button"], button[aria-label*="Send"]',getMessageText:e=>{let o=e.innerText||e.textContent||"";if(!o&&e.childNodes.length>0){const r=[];e.childNodes.forEach(t=>{t.nodeType===3?r.push(t.textContent||""):t.nodeType===1&&r.push(t.innerText||t.textContent||"")}),o=r.join("")}return console.log("[GuardFlow] ChatGPT text extraction:",{elementText:e.innerText,textContent:e.textContent,childCount:e.childNodes.length,finalText:o,finalLength:o.length}),o},isReady:()=>!!document.querySelector("#prompt-textarea")},"chatgpt.com":{name:"ChatGPT",textarea:"#prompt-textarea",submitButton:'button[data-testid="send-button"], button[data-testid="fruitjuice-send-button"], button[aria-label*="Send"]',getMessageText:e=>{let o=e.innerText||e.textContent||"";if(!o&&e.childNodes.length>0){const r=[];e.childNodes.forEach(t=>{t.nodeType===3?r.push(t.textContent||""):t.nodeType===1&&r.push(t.innerText||t.textContent||"")}),o=r.join("")}return console.log("[GuardFlow] ChatGPT text extraction:",{elementText:e.innerText,textContent:e.textContent,childCount:e.childNodes.length,finalText:o,finalLength:o.length}),o},isReady:()=>!!document.querySelector("#prompt-textarea")},"claude.ai":{name:"Claude",textarea:'div[contenteditable="true"][data-testid="chat-input"]',submitButton:'button[aria-label*="Send"]',getMessageText:e=>e.innerText||e.textContent||"",isReady:()=>!!document.querySelector('div[contenteditable="true"][data-testid="chat-input"]')},"gemini.google.com":{name:"Gemini",textarea:"rich-textarea",submitButton:'button[aria-label*="Send"]',getMessageText:e=>e.innerText||e.textContent||"",isReady:()=>!!document.querySelector("rich-textarea")},"www.perplexity.ai":{name:"Perplexity",textarea:'#ask-input, div[role="textbox"][contenteditable="true"]',submitButton:'button[data-testid="submit-button"]',getMessageText:e=>e.innerText||e.textContent||"",isReady:()=>!!document.querySelector("#ask-input")},"chat.groq.com":{name:"Groq",textarea:"textarea#chat",submitButton:'button[type="submit"]',getMessageText:e=>e instanceof HTMLTextAreaElement?e.value:e.textContent||"",isReady:()=>!!document.querySelector("textarea#chat")}};function S(){const e=window.location.hostname;return A[e]||null}async function T(e,o=1e4){if(!e.isReady)return!0;const r=Date.now();for(;Date.now()-r<o;){if(e.isReady())return!0;await new Promise(t=>setTimeout(t,100))}return!1}function m(e,o){return new Promise(r=>{const t=G(),a=P(e,o,n=>{document.body.removeChild(t),r(n)});t.appendChild(a),document.body.appendChild(t),setTimeout(()=>{const n=a.querySelector('[data-action="edit"]');n==null||n.focus()},100)})}function G(){const e=document.createElement("div");return e.id="guardflow-dialog-container",e.style.cssText=`
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 999999;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  `,e}function P(e,o,r){const t=document.createElement("div");t.style.cssText=`
    background: white;
    border-radius: 12px;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
    max-width: 500px;
    width: 90%;
    max-height: 90vh;
    overflow: auto;
  `,t.innerHTML=`
    <div style="padding: 24px; border-bottom: 1px solid #e5e7eb;">
      <div style="display: flex; align-items: center; gap: 12px;">
        <div style="width: 40px; height: 40px; background: #fef3c7; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
            <line x1="12" y1="9" x2="12" y2="13"></line>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
        </div>
        <h2 style="margin: 0; font-size: 18px; font-weight: 600; color: #111827;">
          Potential Secret Detected
        </h2>
      </div>
    </div>

    <div style="padding: 24px;">
      <p style="margin: 0 0 16px 0; font-size: 14px; color: #6b7280;">
        We found what appears to be sensitive information in your message:
      </p>

      <div style="margin-bottom: 16px; display: flex; flex-direction: column; gap: 12px;">
        ${e.secrets.map(d=>F(d,o)).join("")}
      </div>

      <div style="background: #f9fafb; border-radius: 8px; padding: 16px;">
        <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: 500; color: #111827;">
          ⚠️ Security Warning
        </p>
        <p style="margin: 0 0 8px 0; font-size: 13px; color: #6b7280;">
          Sending secrets or API keys to AI models can be a security risk. These values may
          be stored in logs, used for training, or accidentally exposed.
        </p>
        <p style="margin: 0; font-size: 13px; color: #6b7280;">
          We recommend removing or masking sensitive information before sending.
        </p>
      </div>
    </div>

    <div style="padding: 16px 24px; border-top: 1px solid: #e5e7eb; display: flex; flex-direction: column; gap: 8px;">
      <button
        data-action="edit"
        style="width: 100%; padding: 10px 16px; background: #2563eb; color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
        </svg>
        Edit Message
      </button>

      <div style="display: flex; gap: 8px;">
        <button
          data-action="send-anyway"
          style="flex: 1; padding: 8px 16px; background: #fef3c7; color: #92400e; border: 1px solid #fde047; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
          Send Anyway
        </button>
        <button
          data-action="cancel"
          style="flex: 1; padding: 8px 16px; background: white; color: #374151; border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="15" y1="9" x2="9" y2="15"></line>
            <line x1="9" y1="9" x2="15" y2="15"></line>
          </svg>
          Cancel
        </button>
      </div>
    </div>

    <div style="background: #f9fafb; padding: 12px 24px; border-top: 1px solid #e5e7eb; border-bottom-left-radius: 12px; border-bottom-right-radius: 12px;">
      <p style="margin: 0; font-size: 12px; color: #6b7280;">
        💡 Tip: You can use <code style="background: #e5e7eb; padding: 2px 6px; border-radius: 4px; color: #374151;">[REDACTED]</code> or
        <code style="background: #e5e7eb; padding: 2px 6px; border-radius: 4px; color: #374151;">****</code> to mask sensitive values
      </p>
    </div>
  `;const a=t.querySelector('[data-action="edit"]'),n=t.querySelector('[data-action="send-anyway"]'),s=t.querySelector('[data-action="cancel"]');return a==null||a.addEventListener("click",()=>r("edit")),n==null||n.addEventListener("click",()=>r("send-anyway")),s==null||s.addEventListener("click",()=>r("cancel")),[a,n,s].forEach(d=>{if(!d)return;const u=d;u.addEventListener("mouseenter",()=>{u.style.opacity="0.9",u.style.transform="scale(0.98)"}),u.addEventListener("mouseleave",()=>{u.style.opacity="1",u.style.transform="scale(1)"})}),t}function F(e,o){const r=v(o,e);return`
    <div style="display: flex; align-items: start; gap: 12px; padding: 12px; background: #fef3c7; border: 1px solid #fde047; border-radius: 8px;">
      <div style="width: 20px; height: 20px; background: #fde047; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 2px;">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#92400e" stroke-width="2">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
          <line x1="12" y1="9" x2="12" y2="13"></line>
          <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>
      </div>
      <div style="flex: 1;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
          <span style="font-size: 13px; font-weight: 500; color: #92400e;">
            ${g(e.type)}
          </span>
          ${r>1?`<span style="font-size: 11px; color: #92400e;">at line ${r}</span>`:""}
        </div>
        <code style="display: block; padding: 6px 8px; background: #fef9c3; border-radius: 4px; font-size: 12px; font-family: 'Courier New', monospace; color: #713f12; word-break: break-all;">
          ${g(e.preview)}
        </code>
      </div>
    </div>
  `}function g(e){const o=document.createElement("div");return o.textContent=e,o.innerHTML}let i=!1,l=!1;const c={secretsDetected:0,secretsBlocked:0,messagesSent:0};async function p(){console.log("[GuardFlow] Content script initializing...");const e=S();if(!e){console.log("[GuardFlow] No site config found for this page");return}if(console.log("[GuardFlow] Site config found:",e),!await T(e,1e4)){console.log("[GuardFlow] Site took too long to load");return}console.log("[GuardFlow] Site is ready, setting up interception"),z(e),C(e)}function z(e){if(!e)return;console.log("[GuardFlow] Looking for submit button:",e.submitButton),new MutationObserver(()=>{const t=document.querySelector(e.submitButton);t&&!t.hasAttribute("data-guardflow-initialized")&&(console.log("[GuardFlow] Found submit button via MutationObserver"),b(t,e))}).observe(document.body,{childList:!0,subtree:!0}),console.log("[GuardFlow] MutationObserver started");const r=document.querySelector(e.submitButton);r?(console.log("[GuardFlow] Found submit button immediately"),b(r,e)):console.log("[GuardFlow] Submit button not found yet, waiting for DOM...")}function C(e){if(!e)return;console.log("[GuardFlow] Setting up Enter key interception on:",e.textarea),new MutationObserver(()=>{const t=document.querySelector(e.textarea);t&&!t.hasAttribute("data-guardflow-keyhandler-initialized")&&(console.log("[GuardFlow] Found textarea via MutationObserver, attaching key handler"),y(t,e))}).observe(document.body,{childList:!0,subtree:!0});const r=document.querySelector(e.textarea);r?(console.log("[GuardFlow] Found textarea immediately, attaching key handler"),y(r,e)):console.log("[GuardFlow] Textarea not found yet, waiting for DOM...")}function y(e,o){o&&(e.setAttribute("data-guardflow-keyhandler-initialized","true"),console.log("[GuardFlow] Enter key handler attached to textarea"),e.addEventListener("keydown",async r=>{if(!(r.key==="Enter"&&!r.shiftKey))return;if(console.log("[GuardFlow] Enter key pressed!"),l){console.log("[GuardFlow] Allowing submission via Enter (user bypassed warning)"),l=!1;return}if(i){console.log("[GuardFlow] Already processing, ignoring duplicate Enter press");return}const a=o.getMessageText(e);if(console.log("[GuardFlow] Message text extracted, length:",a==null?void 0:a.length),!a||a.trim().length===0){console.log("[GuardFlow] Empty message, allowing submission");return}r.preventDefault(),r.stopPropagation(),i=!0;try{console.log("[GuardFlow] Running secret detection...");const n=await x(a);if(console.log("[GuardFlow] Detection result:",n),n.hasSecrets){console.log("[GuardFlow] Secrets detected! Count:",n.count),c.secretsDetected+=n.count,console.log("[GuardFlow] Showing warning dialog...");const d=await m(n,a);if(console.log("[GuardFlow] User choice:",d),d==="cancel"){console.log("[GuardFlow] User cancelled submission"),c.secretsBlocked+=n.count,i=!1;return}if(d==="edit"){console.log("[GuardFlow] User chose to edit"),c.secretsBlocked+=n.count,e.focus(),i=!1;return}console.log("[GuardFlow] User chose to send anyway")}else console.log("[GuardFlow] No secrets detected");c.messagesSent++,i=!1,l=!0,console.log("[GuardFlow] Allowing submission to proceed via Enter key");const s=new KeyboardEvent("keydown",{key:"Enter",code:"Enter",keyCode:13,which:13,bubbles:!0,cancelable:!0});e.dispatchEvent(s)}catch(n){console.error("[GuardFlow] Error during secret detection:",n),i=!1,l=!0;const s=new KeyboardEvent("keydown",{key:"Enter",code:"Enter",keyCode:13,which:13,bubbles:!0,cancelable:!0});e.dispatchEvent(s)}}))}function b(e,o){o&&(e.setAttribute("data-guardflow-initialized","true"),console.log("[GuardFlow] Click handler attached to submit button"),e.addEventListener("click",async r=>{if(console.log("[GuardFlow] Submit button clicked!"),l){console.log("[GuardFlow] Allowing submission (user bypassed warning)"),l=!1;return}if(i){console.log("[GuardFlow] Already processing, ignoring duplicate click");return}const t=document.querySelector(o.textarea);if(!t){console.log("[GuardFlow] Textarea not found:",o.textarea);return}console.log("[GuardFlow] Textarea found");const a=o.getMessageText(t);if(console.log("[GuardFlow] Message text extracted, length:",a==null?void 0:a.length),!a||a.trim().length===0){console.log("[GuardFlow] Empty message, allowing submission");return}r.preventDefault(),r.stopPropagation(),r.stopImmediatePropagation(),i=!0;try{console.log("[GuardFlow] Running secret detection...");const n=await x(a);if(console.log("[GuardFlow] Detection result:",n),n.hasSecrets){console.log("[GuardFlow] Secrets detected! Count:",n.count),c.secretsDetected+=n.count,console.log("[GuardFlow] Showing warning dialog...");const s=await m(n,a);if(console.log("[GuardFlow] User choice:",s),s==="cancel"){console.log("[GuardFlow] User cancelled submission"),c.secretsBlocked+=n.count,i=!1;return}if(s==="edit"){console.log("[GuardFlow] User chose to edit"),c.secretsBlocked+=n.count,t.focus(),i=!1;return}console.log("[GuardFlow] User chose to send anyway")}else console.log("[GuardFlow] No secrets detected");c.messagesSent++,i=!1,l=!0,console.log("[GuardFlow] Allowing submission to proceed"),e.click()}catch(n){console.error("[GuardFlow] Error during secret detection:",n),i=!1,l=!0,e.click()}},!0))}async function I(){try{await chrome.storage.local.set({stats:c})}catch{}}async function h(){try{const e=await chrome.storage.local.get("stats");e.stats&&Object.assign(c,e.stats)}catch{}}console.log("[GuardFlow] Content script loaded, readyState:",document.readyState);document.readyState==="loading"?document.addEventListener("DOMContentLoaded",async()=>{console.log("[GuardFlow] DOM content loaded"),await h(),p()}):(console.log("[GuardFlow] DOM already loaded, initializing immediately"),h().then(()=>p()));setInterval(I,1e4);window.__guardflow={stats:c,version:"1.0.0"};
