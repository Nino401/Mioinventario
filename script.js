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

    // Costante per la chiave del localStorage
    const STORAGE_KEY = 'smartInventoryApp';

    // Stato dell'applicazione (l'inventario)
    let inventory = {};

    // Inizializza il lettore di codici a barre
    const codeReader = new ZXing.BrowserMultiFormatReader();

    // --- FUNZIONI DI GESTIONE INVENTARIO ---

    // Carica l'inventario dal localStorage
    const loadInventory = () => {
        const savedInventory = localStorage.getItem(STORAGE_KEY);
        if (savedInventory) {
            inventory = JSON.parse(savedInventory);
        }
    };

    // Salva l'inventario nel localStorage
    const saveInventory = () => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(inventory));
    };
    
    // Aggiorna la visualizzazione della tabella dell'inventario
    const updateInventoryDisplay = () => {
        inventoryTableBody.innerHTML = ''; // Svuota la tabella
        
        // Ordina i codici alfanumericamente per una visualizzazione consistente
        const sortedCodes = Object.keys(inventory).sort();

        if (sortedCodes.length === 0) {
            const row = `<tr><td colspan="3" style="text-align: center;">L'inventario è vuoto.</td></tr>`;
            inventoryTableBody.innerHTML = row;
            return;
        }

        for (const code of sortedCodes) {
            const quantity = inventory[code];
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${code}</td>
                <td>${quantity}</td>
                <td><button class="reset-btn" data-code="${code}"><i class="fa-solid fa-trash"></i> Reset</button></td>
            `;
            inventoryTableBody.appendChild(row);
        }

        // Aggiungi gli event listener ai nuovi pulsanti di reset
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

    // Aggiunge un articolo all'inventario
    const addItem = () => {
        const code = scannedCodeInput.value.trim();
        if (code) {
            inventory[code] = (inventory[code] || 0) + 1;
            saveInventory();
            updateInventoryDisplay();
            scannedCodeInput.value = ''; // Pulisce il campo dopo l'aggiunta
            scannedCodeInput.style.backgroundColor = '#d4edda'; // Feedback visivo positivo
            setTimeout(() => { scannedCodeInput.style.backgroundColor = '#e9ecef'; }, 500);
        } else {
            alert('Nessun codice da aggiungere.');
        }
    };

    // Rimuove un articolo dall'inventario
    const removeItem = () => {
        const code = scannedCodeInput.value.trim();
        if (code && inventory[code]) {
            inventory[code] -= 1;
            if (inventory[code] <= 0) {
                delete inventory[code]; // Rimuove l'articolo se la quantità è 0
            }
            saveInventory();
            updateInventoryDisplay();
            scannedCodeInput.value = ''; // Pulisce il campo dopo la rimozione
            scannedCodeInput.style.backgroundColor = '#f8d7da'; // Feedback visivo negativo
            setTimeout(() => { scannedCodeInput.style.backgroundColor = '#e9ecef'; }, 500);
        } else {
            alert('Codice non presente nell\'inventario o campo vuoto.');
        }
    };

    // --- FUNZIONI DI REPORTING ---
    
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
                headStyles: { fillColor: [0, 90, 156] } // Colore blu per l'header
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
            await navigator.share({
                title: 'Report Inventario',
                text: reportText,
            });
        } catch (error) {
            console.error('Errore durante la condivisione:', error);
        }
    };


    // --- INIZIALIZZAZIONE SCANNER ---
    
    const startScanner = () => {
        codeReader.listVideoInputDevices()
            .then((videoInputDevices) => {
                let selectedDeviceId = null;
                // Cerca una fotocamera posteriore
                const rearCamera = videoInputDevices.find(device => 
                    device.label.toLowerCase().includes('back') || 
                    device.label.toLowerCase().includes('rear') ||
                    device.label.toLowerCase().includes('posteriore')
                );

                if (rearCamera) {
                    selectedDeviceId = rearCamera.deviceId;
                } else if (videoInputDevices.length > 0) {
                    // Altrimenti usa la prima disponibile
                    selectedDeviceId = videoInputDevices[0].deviceId;
                } else {
                    cameraFeedback.textContent = 'Nessuna fotocamera trovata.';
                    return;
                }
                
                cameraFeedback.textContent = 'Punta la fotocamera su un codice...';
                scannerLaser.style.display = 'block';

                codeReader.decodeFromVideoDevice(selectedDeviceId, 'video', (result, err) => {
                    if (result) {
                        scannedCodeInput.value = result.getText();
                        // Vibrazione per feedback (su dispositivi supportati)
                        if ('vibrate' in navigator) {
                            navigator.vibrate(100);
                        }
                    }
                    if (err && !(err instanceof ZXing.NotFoundException)) {
                        console.error(err);
                        cameraFeedback.textContent = `Errore scanner: ${err}`;
                    }
                });
            })
            .catch((err) => {
                console.error(err);
                cameraFeedback.textContent = 'Impossibile accedere alla fotocamera. Controlla i permessi.';
                alert('Per usare lo scanner, devi concedere il permesso di accesso alla fotocamera. Assicurati di usare una connessione HTTPS.');
            });
    };

    // --- AGGANCIO EVENTI E AVVIO ---

    addBtn.addEventListener('click', addItem);
    removeBtn.addEventListener('click', removeItem);
    exportPdfBtn.addEventListener('click', generatePDF);
    shareBtn.addEventListener('click', shareReport);

    // Carica i dati e avvia tutto
    loadInventory();
    updateInventoryDisplay();
    startScanner();
});