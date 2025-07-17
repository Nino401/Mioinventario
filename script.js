document.addEventListener('DOMContentLoaded', () => {
    // Riferimenti agli elementi del DOM
    const video = document.getElementById('video');
    const scannedCodeInput = document.getElementById('scanned-code-input');
    const addBtn = document.getElementById('add-btn');
    const removeBtn = document.getElementById('remove-btn');
    const inventoryTableBody = document.getElementById('inventory-table-body');
    const exportPdfBtn = document.getElementById('export-pdf-btn');
    const shareBtn = document.getElementById('share-btn');
    const cameraFeedback = document.getElementById('camera-feedback');
    const scannerLaser = document.querySelector('.scanner-laser');

    const STORAGE_KEY = 'smartInventoryApp';
    let inventory = {};

    // Inizializza il lettore di codici. Non è più necessario `BrowserMultiFormatReader`
    // perché gestiremo noi lo stream.
    const codeReader = new ZXing.BrowserCodeReader();
    let activeStream = null; // Variabile per tenere traccia dello stream attivo

    // --- FUNZIONI DI GESTIONE INVENTARIO (invariate) ---
    const loadInventory = () => {
        const savedInventory = localStorage.getItem(STORAGE_KEY);
        if (savedInventory) {
            inventory = JSON.parse(savedInventory);
        }
    };

    const saveInventory = () => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(inventory));
    };
    
    const updateInventoryDisplay = () => {
        inventoryTableBody.innerHTML = '';
        const sortedCodes = Object.keys(inventory).sort();

        if (sortedCodes.length === 0) {
            inventoryTableBody.innerHTML = `<tr><td colspan="3" style="text-align: center;">L'inventario è vuoto.</td></tr>`;
            return;
        }

        sortedCodes.forEach(code => {
            const quantity = inventory[code];
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${code}</td>
                <td>${quantity}</td>
                <td><button class="reset-btn" data-code="${code}"><i class="fa-solid fa-trash"></i> Reset</button></td>
            `;
            inventoryTableBody.appendChild(row);
        });

        document.querySelectorAll('.reset-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const codeToReset = e.currentTarget.dataset.code;
                if (confirm(`Sei sicuro di voler azzerare il conteggio per l'articolo ${codeToReset}?`)) {
                    delete inventory[codeToReset];
                    saveInventory();
                    updateInventoryDisplay();
                }
            });
        });
    };

    const addItem = () => {
        const code = scannedCodeInput.value.trim();
        if (code) {
            inventory[code] = (inventory[code] || 0) + 1;
            saveInventory();
            updateInventoryDisplay();
            scannedCodeInput.value = '';
            scannedCodeInput.style.backgroundColor = '#d4edda';
            setTimeout(() => { scannedCodeInput.style.backgroundColor = '#e9ecef'; }, 500);
        } else {
            alert('Nessun codice da aggiungere.');
        }
    };

    const removeItem = () => {
        const code = scannedCodeInput.value.trim();
        if (code && inventory[code]) {
            inventory[code] -= 1;
            if (inventory[code] <= 0) {
                delete inventory[code];
            }
            saveInventory();
            updateInventoryDisplay();
            scannedCodeInput.value = '';
            scannedCodeInput.style.backgroundColor = '#f8d7da';
            setTimeout(() => { scannedCodeInput.style.backgroundColor = '#e9ecef'; }, 500);
        } else {
            alert('Codice non presente nell\'inventario o campo vuoto.');
        }
    };

    // --- FUNZIONI DI REPORTING (invariate) ---
    const generatePDF = () => {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        doc.setFontSize(18);
        doc.text("Report Inventario", 14, 22);
        doc.setFontSize(11);
        doc.setTextColor(100);
        doc.text(`Generato il: ${new Date().toLocaleString('it-IT')}`, 14, 30);
        const tableData = Object.entries(inventory).map(([code, quantity]) => [code, quantity]);
        if (tableData.length === 0) {
            doc.text("L'inventario è vuoto.", 14, 40);
        } else {
            doc.autoTable({
                head: [['Codice Articolo', 'Quantità']],
                body: tableData,
                startY: 35,
                theme: 'grid',
                headStyles: { fillColor: [0, 90, 156] }
            });
        }
        doc.save(`report-inventario-${Date.now()}.pdf`);
    };

    const shareReport = async () => {
        if (!navigator.share) {
            alert("La condivisione non è supportata su questo browser/dispositivo.");
            return;
        }
        let reportText = "Report Inventario:\n\n";
        if (Object.keys(inventory).length === 0) {
            reportText += "L'inventario è vuoto.";
        } else {
            for (const [code, quantity] of Object.entries(inventory)) {
                reportText += `- ${code}: ${quantity} pz.\n`;
            }
        }
        try {
            await navigator.share({ title: 'Report Inventario', text: reportText });
        } catch (error) {
            console.error('Errore durante la condivisione:', error);
        }
    };

    // --- INIZIALIZZAZIONE SCANNER (NUOVA VERSIONE CORRETTA) ---
    const startScanner = async () => {
        try {
            // Chiediamo esplicitamente la fotocamera posteriore ('environment')
            const constraints = {
                video: {
                    facingMode: 'environment'
                }
            };
            
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            activeStream = stream; // Salva lo stream per poterlo fermare dopo
            video.srcObject = stream;

            // Nasconde il messaggio di feedback e mostra il laser quando il video parte
            video.addEventListener('playing', () => {
                cameraFeedback.style.display = 'none';
                scannerLaser.style.display = 'block';
            });

            // Avvia la decodifica continua dal video
            codeReader.decodeFromVideoElement(video, (result, err) => {
                if (result) {
                    scannedCodeInput.value = result.getText();
                    if ('vibrate' in navigator) {
                        navigator.vibrate(100);
                    }
                }
                if (err && !(err instanceof ZXing.NotFoundException)) {
                    console.error('Errore di decodifica:', err);
                    cameraFeedback.textContent = `Errore scanner.`;
                    cameraFeedback.style.display = 'block';
                }
            });

        } catch (err) {
            console.error("Errore nell'accesso alla fotocamera:", err);
            scannerLaser.style.display = 'none';
            cameraFeedback.style.display = 'block';
            
            // Fornisce un feedback più specifico all'utente
            if (err.name === 'NotAllowedError') {
                cameraFeedback.textContent = 'Permesso fotocamera negato. Abilitalo dalle impostazioni del browser.';
            } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
                cameraFeedback.textContent = 'Nessuna fotocamera posteriore trovata.';
            } else {
                cameraFeedback.textContent = 'Errore fotocamera. Ricarica la pagina.';
            }
        }
    };

    // Funzione per fermare lo stream della fotocamera (buona pratica)
    // Non è usata attivamente ora ma è utile averla
    const stopScanner = () => {
        if (activeStream) {
            activeStream.getTracks().forEach(track => track.stop());
            video.srcObject = null;
            activeStream = null;
        }
    };
    
    // --- AGGANCIO EVENTI E AVVIO ---
    addBtn.addEventListener('click', addItem);
    removeBtn.addEventListener('click', removeItem);
    exportPdfBtn.addEventListener('click', generatePDF);
    shareBtn.addEventListener('click', shareReport);

    loadInventory();
    updateInventoryDisplay();
    startScanner();
});