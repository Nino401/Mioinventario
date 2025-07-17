document.addEventListener('DOMContentLoaded', () => {
    // Riferimenti DOM
    const video = document.getElementById('video');
    const scannedCodeInput = document.getElementById('scanned-code-input');
    const addBtn = document.getElementById('add-btn');
    const removeBtn = document.getElementById('remove-btn');
    const inventoryTableBody = document.getElementById('inventory-table-body');
    const exportPdfBtn = document.getElementById('export-pdf-btn');
    const shareBtn = document.getElementById('share-btn');
    const startCameraBtn = document.getElementById('start-camera-btn');
    const startScannerOverlay = document.getElementById('start-scanner-overlay');
    const scannerLaser = document.querySelector('.scanner-laser');
    const debugLog = document.getElementById('debug-log');

    const STORAGE_KEY = 'smartInventoryApp';
    let inventory = {};

    // Funzione per scrivere nel log di debug visibile
    const log = (message) => {
        console.log(message); // Mantiene il log anche nella console del browser
        debugLog.textContent += `> ${message}\n`;
        debugLog.scrollTop = debugLog.scrollHeight; // Scrolla in basso automaticamente
    };

    const codeReader = new ZXing.BrowserMultiFormatReader();
    let selectedDeviceId = null;

    log('Script inizializzato. In attesa di avvio scanner.');

    // --- GESTIONE SCANNER ---
    const startScanner = () => {
        log('Avvio dello scanner in corso...');
        startScannerOverlay.style.display = 'none';

        codeReader.listVideoInputDevices()
            .then((videoInputDevices) => {
                log(`Trovate ${videoInputDevices.length} fotocamere.`);
                if (videoInputDevices.length === 0) {
                    log('ERRORE: Nessuna fotocamera trovata sul dispositivo.');
                    alert('Nessuna fotocamera trovata.');
                    return;
                }

                // Logga i nomi delle fotocamere trovate per debug
                videoInputDevices.forEach((device, index) => {
                    log(`  - Fotocamera ${index}: ${device.label} (ID: ${device.deviceId})`);
                });

                // Tenta di trovare la fotocamera posteriore
                const rearCamera = videoInputDevices.find(device => 
                    device.label.toLowerCase().includes('back') || 
                    device.label.toLowerCase().includes('rear') ||
                    device.label.toLowerCase().includes('posteriore')
                );

                if (rearCamera) {
                    selectedDeviceId = rearCamera.deviceId;
                    log(`Fotocamera posteriore trovata. Uso: ${rearCamera.label}`);
                } else {
                    // Altrimenti, usa la prima della lista
                    selectedDeviceId = videoInputDevices[0].deviceId;
                    log(`Fotocamera posteriore non identificata. Uso la prima disponibile: ${videoInputDevices[0].label}`);
                }

                log('Tentativo di avviare lo streaming video...');
                codeReader.decodeFromVideoDevice(selectedDeviceId, 'video', (result, err) => {
                    video.style.display = 'block';
                    scannerLaser.style.display = 'block';

                    if (result) {
                        log(`Codice rilevato: ${result.getText()}`);
                        scannedCodeInput.value = result.getText();
                        if ('vibrate' in navigator) {
                            navigator.vibrate(100);
                        }
                    }

                    if (err && !(err instanceof ZXing.NotFoundException)) {
                        log(`ERRORE durante la decodifica: ${err}`);
                    }
                });

            })
            .catch((err) => {
                log(`ERRORE CRITICO durante l'accesso alle fotocamere: ${err}`);
                alert(`Impossibile accedere alla fotocamera. Controlla i permessi e assicurati di usare HTTPS. Errore: ${err.name}`);
            });
    };

    // --- FUNZIONI INVENTARIO E REPORT (invariate) ---
    const loadInventory=()=>{const t=localStorage.getItem(STORAGE_KEY);t&&(inventory=JSON.parse(t))},saveInventory=()=>{localStorage.setItem(STORAGE_KEY,JSON.stringify(inventory))},updateInventoryDisplay=()=>{inventoryTableBody.innerHTML="";const t=Object.keys(inventory).sort();if(0===t.length)return void(inventoryTableBody.innerHTML='<tr><td colspan="3" style="text-align: center;">L\'inventario è vuoto.</td></tr>');for(const e of t){const o=inventory[e],a=document.createElement("tr");a.innerHTML=`\n                <td>${e}</td>\n                <td>${o}</td>\n                <td><button class="reset-btn" data-code="${e}"><i class="fa-solid fa-trash"></i> Reset</button></td>\n            `,inventoryTableBody.appendChild(a)}document.querySelectorAll(".reset-btn").forEach(t=>{t.addEventListener("click",t=>{const e=t.currentTarget.dataset.code;confirm(`Sei sicuro di voler azzerare il conteggio per l'articolo ${e}?`)&&(delete inventory[e],saveInventory(),updateInventoryDisplay())})})},addItem=()=>{const t=scannedCodeInput.value.trim();t?(inventory[t]=(inventory[t]||0)+1,saveInventory(),updateInventoryDisplay(),scannedCodeInput.value="",scannedCodeInput.style.backgroundColor="#d4edda",setTimeout(()=>{scannedCodeInput.style.backgroundColor="#e9ecef"},500)):alert("Nessun codice da aggiungere.")},removeItem=()=>{const t=scannedCodeInput.value.trim();t&&inventory[t]?(inventory[t]-=1,inventory[t]<=0&&delete inventory[t],saveInventory(),updateInventoryDisplay(),scannedCodeInput.value="",scannedCodeInput.style.backgroundColor="#f8d7da",setTimeout(()=>{scannedCodeInput.style.backgroundColor="#e9ecef"},500)):alert("Codice non presente nell'inventario o campo vuoto.")},generatePDF=()=>{const{jsPDF:t}=window.jspdf,e=new t;e.setFontSize(18),e.text("Report Inventario",14,22),e.setFontSize(11),e.setTextColor(100),e.text(`Generato il: ${new Date().toLocaleString("it-IT")}`,14,30);const o=Object.entries(inventory).map(([t,e])=>[t,e]);0===o.length?e.text("L'inventario è vuoto.",14,40):e.autoTable({head:[["Codice Articolo","Quantità"]],body:o,startY:35,theme:"grid",headStyles:{fillColor:[0,90,156]}}),e.save(`report-inventario-${Date.now()}.pdf`)},shareReport=async()=>{if(!navigator.share)return void alert("La condivisione non è supportata su questo browser/dispositivo.");let t="Report Inventario:\n\n";if(0===Object.keys(inventory).length)t+="L'inventario è vuoto.";else for(const[e,o]of Object.entries(inventory))t+=`- ${e}: ${o} pz.\n`;try{await navigator.share({title:"Report Inventario",text:t})}catch(t){console.error("Errore durante la condivisione:",t)}};
    
    // --- AGGANCIO EVENTI E AVVIO ---
    startCameraBtn.addEventListener('click', startScanner);
    addBtn.addEventListener('click', addItem);
    removeBtn.addEventListener('click', removeItem);
    exportPdfBtn.addEventListener('click', generatePDF);
    shareBtn.addEventListener('click', shareReport);

    loadInventory();
    updateInventoryDisplay();
});