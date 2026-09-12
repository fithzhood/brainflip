// Numero di build, letto dal ?v= sul tag di questo script: serve a capire a
// colpo d'occhio se il telefono sta girando la versione appena pubblicata.
const APP_BUILD = (() => {
    const src = (document.currentScript && document.currentScript.src) || '';
    const m = src.match(/[?&]v=(\d+)/);
    return m ? m[1] : '?';
})();

// Vero solo dentro il guscio Android, mai in una scheda del browser.
function isCapacitorNative() {
    return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
}

document.addEventListener('DOMContentLoaded', () => {
    if (isCapacitorNative()) document.body.classList.add('capacitor');
    // --- Elementi DOM --- //
    const appContainer = document.querySelector('.app-container');
    const quizModeBtn = document.getElementById('quiz-mode-btn');
    const cardModeBtn = document.getElementById('card-mode-btn');
    const quizView = document.getElementById('quiz-view');
    const cardModeView = document.getElementById('card-mode-view');
    const cardListContainer = document.getElementById('card-list-container');
    const cardList = document.getElementById('card-list');
    const cardEditorContainer = document.getElementById('card-editor-container');
    const editorTitle = document.getElementById('editor-title');
    const editingCardIdInput = document.getElementById('editing-card-id');
    const questionInput = document.getElementById('question-input');
    const answersEditor = document.getElementById('answers-editor');
    const answerEditGroups = answersEditor.querySelectorAll('.answer-edit-group');
    const saveCardBtn = document.getElementById('save-card-btn');
    const deleteCardBtn = document.getElementById('delete-card-btn');
    const backToListBtn = document.getElementById('back-to-list-btn');
    const clearStorageBtn = document.getElementById('clear-storage-btn');

    // --- Elementi Aggiunti per Immagine Domanda --- //
    const questionImageInput = document.getElementById('question-image-input');
    const questionImagePreview = document.getElementById('question-image-preview');
    const questionImageDataInput = document.getElementById('question-image-data');
    const removeQuestionImageBtn = document.getElementById('remove-question-image-btn');

    // Quiz View Elements
    const quizContent = document.getElementById('quiz-content');
    const questionDisplay = document.getElementById('question-display');
    const answersDisplay = document.getElementById('answers-display');
    const nextQuestionBtn = document.getElementById('next-question-btn');
    const quizComplete = document.getElementById('quiz-complete');
    const finalScoreDisplay = document.getElementById('final-score');
    const totalQuestionsDisplay = document.getElementById('total-questions');
    const restartQuizBtn = document.getElementById('restart-quiz-btn');
    const noCardsMessage = document.getElementById('no-cards-message');

    // --- Elementi Aggiunti per Esporta/Importa --- //
    const exportCardsBtn = document.getElementById('export-cards-btn');
    const importCardsBtn = document.getElementById('import-cards-btn');
    const importFileInput = document.getElementById('import-file-input');


    // --- Elementi Aggiunti per GIF Mode --- //
    const gifOverlay = document.getElementById('gif-overlay');
    const gifDisplay = document.getElementById('gif-display');
    const gifDurationDisplay = document.getElementById('gif-duration-display');

    // --- Stato Applicazione --- //
    let cards = [];
    let currentQuizCards = [];
    let currentQuestionIndex = 0;
    let score = 0;
    const localStorageKey = 'flashcardsAppCards_BF2'; // Chiave univoca

    // --- Stato GIF Mode --- //
    let isGifModeActive = false;
    let activeGifUrls = []; // Array di Object URL temporanei
    let currentGifDisplayQueue = []; // Coda per mostrare le GIF senza ripetizioni immediate
    let currentGifDuration = 10; // Durata iniziale in secondi

    // --- Funzioni Gestione Dati --- //

    function loadCards() {
        const storedCards = localStorage.getItem(localStorageKey);
        cards = storedCards ? JSON.parse(storedCards) : [];
        console.log("Cards caricate:", cards.length); // Ripristinato console.log
    }

    function saveCards() {
        let dataToSave = '';
        try {
            // Rimosso log pre-serializzazione
            dataToSave = JSON.stringify(cards);
            // Rimosso log dimensione e pre-setItem

            localStorage.setItem(localStorageKey, dataToSave);
            console.log("Cards salvate nel localStorage."); // Ripristinato console.log

        } catch (error) {
            // Rimosso alert, mantenuto console.error silenzioso
            console.error(`ERRORE (ignorato) durante saveCards: ${error.name} - ${error.message}`);
            // L'esecuzione continua perché l'utente ha confermato che il salvataggio funziona comunque
        }
    }

    function clearAllCards() {
        if (confirm("Sei sicuro di voler eliminare tutte le flashcard? Questa azione non può essere annullata.")) {
            // Rimuovi i dati dal localStorage
            localStorage.removeItem(localStorageKey);
            
            // Svuota l'array delle card
            cards = [];
            
            // Aggiorna l'interfaccia
            displayCardList();
            
            // Mostra conferma
            alert("Tutte le flashcard sono state eliminate.");
            
            console.log("Dati cancellati dal localStorage.");
        }
    }

    function generateId() {
        return Date.now().toString();
    }

    // --- Funzioni Gestione Viste --- //

    function switchView(viewToShow) {
        quizView.classList.remove('active-view');
        cardModeView.classList.remove('active-view');
        viewToShow.classList.add('active-view');

        quizModeBtn.classList.toggle('active', viewToShow === quizView);
        cardModeBtn.classList.toggle('active', viewToShow === cardModeView);

        // Se si passa alla vista Quiz, inizializzala
        if (viewToShow === quizView) {
            initializeQuizView();
        }
        // Se si passa alla vista Card, mostra la lista (resetta eventuali stati editor)
        if (viewToShow === cardModeView) {
            showCardList();
            displayCardList(); // Ricarica la lista ogni volta
        }
    }

    function showCardList() {
        cardListContainer.style.display = 'block';
        cardEditorContainer.style.display = 'none';
    }

    function showEditor() {
        cardListContainer.style.display = 'none';
        cardEditorContainer.style.display = 'block';
    }

    // --- Funzioni Gestione Card Mode --- //

    function displayCardList() {
        cardList.innerHTML = ''; // Pulisce la lista precedente

        // Aggiunge l'opzione "Crea Nuova Card"
        const newCardLi = document.createElement('li');
        newCardLi.className = 'card-list-item new-card-item';
        newCardLi.textContent = '+ Crea Nuova Card';
        newCardLi.dataset.id = 'new';
        newCardLi.addEventListener('click', handleCardSelect);
        cardList.appendChild(newCardLi);

        // Aggiunge le card esistenti
        if (cards.length > 0) {
             cards.forEach(card => {
                const li = document.createElement('li');
                li.className = 'card-list-item';
                li.dataset.id = card.id;
                // Mostra solo il testo della domanda nella lista (anche se c'è anche un'immagine)
                const questionTextForList = card.questionText || "[Domanda con Immagine]";
                li.textContent = questionTextForList.substring(0, 50) + (questionTextForList.length > 50 ? '...' : '');
                li.addEventListener('click', handleCardSelect);
                cardList.appendChild(li);
            });
        } else {
            const noCardsLi = document.createElement('li');
            noCardsLi.style.textAlign = 'center';
            noCardsLi.style.padding = '10px';
            noCardsLi.style.color = '#888';
            noCardsLi.textContent = 'Nessuna card creata.';
            cardList.appendChild(noCardsLi);
        }
    }

    function handleCardSelect(event) {
        const selectedId = event.target.dataset.id;
        if (selectedId === 'new') {
            openNewCardEditor();
        } else {
            const cardToEdit = cards.find(card => card.id === selectedId);
            if (cardToEdit) {
                openEditCardEditor(cardToEdit);
            }
        }
    }

    function resetEditor() {
        editorTitle.textContent = 'Crea Nuova Card';
        editingCardIdInput.value = '';
        questionInput.value = '';
        deleteCardBtn.style.display = 'none';

        // Reset immagine domanda (mantiene il testo)
        questionImageInput.value = '';
        questionImagePreview.src = '';
        questionImagePreview.style.display = 'none';
        questionImageDataInput.value = '';
        if (removeQuestionImageBtn) {
            removeQuestionImageBtn.style.display = 'none';
        }

        answerEditGroups.forEach((group, index) => {
            group.querySelector('.answer-text-input').value = '';
            group.querySelector('.answer-image-input').value = ''; // Resetta input file
            const preview = group.querySelector('.image-preview');
            preview.src = '';
            preview.style.display = 'none';
            group.querySelector('.answer-data').value = ''; // Resetta dati nascosti
            const removeBtn = group.querySelector('.remove-answer-image-btn');
            if (removeBtn) {
                removeBtn.style.display = 'none';
            }
            const radio = group.querySelector('input[type="radio"]');
            radio.checked = false;
            // Deseleziona forzatamente tutti i radio del gruppo
             document.querySelectorAll('input[name="correct-answer-radio"]').forEach(r => r.checked = false);
        });
    }

    function openNewCardEditor() {
        resetEditor();
        showEditor();
    }

    function openEditCardEditor(card) {
        resetEditor(); // Pulisce prima
        editorTitle.textContent = 'Modifica Card';
        editingCardIdInput.value = card.id;
        questionInput.value = card.questionText || ''; // Mostra testo se esiste
        deleteCardBtn.style.display = 'inline-block'; // Mostra pulsante elimina

        // Carica immagine domanda se esiste (non pulisce più il testo)
        questionImagePreview.src = ''; // Pulisci anteprima precedente
        questionImagePreview.style.display = 'none';
        questionImageDataInput.value = '';
        if (removeQuestionImageBtn) {
            removeQuestionImageBtn.style.display = 'none';
        }
        if (card.questionImage) {
            questionImagePreview.src = card.questionImage;
            questionImagePreview.style.display = 'block';
            questionImageDataInput.value = card.questionImage;
            if (removeQuestionImageBtn) {
                removeQuestionImageBtn.style.display = 'flex';
            }
        }

        card.answers.forEach((answer, index) => {
            const group = answerEditGroups[index];
            const textInput = group.querySelector('.answer-text-input');
            const preview = group.querySelector('.image-preview');
            const dataInput = group.querySelector('.answer-data');

            if (answer.type === 'text') {
                textInput.value = answer.content;
                preview.style.display = 'none';
                preview.src = '';
                dataInput.value = answer.content; // Salva testo nel dato nascosto per coerenza
            } else if (answer.type === 'image') {
                textInput.value = '';
                preview.src = answer.content; // Base64
                preview.style.display = 'block';
                dataInput.value = answer.content; // Salva Base64
                const removeBtn = group.querySelector('.remove-answer-image-btn');
                if (removeBtn) {
                    removeBtn.style.display = 'flex';
                }
            }

            if (index === card.correctAnswerIndex) {
                group.querySelector('input[type="radio"]').checked = true;
            }
        });

        showEditor();
    }

    // --- Funzioni Gestione Quiz Mode --- // (Da implementare nelle prossime fasi)
    function initializeQuizView() {
         console.log("Inizializzo vista Quiz");
        // Mostra messaggio se non ci sono card, altrimenti avvia quiz
        if (cards.length === 0) {
            quizContent.style.display = 'none';
            quizComplete.style.display = 'none';
            noCardsMessage.style.display = 'block';
        } else {
            quizContent.style.display = 'flex'; // 'flex': la colonna del quiz la disegna il CSS
            noCardsMessage.style.display = 'none';
            quizComplete.style.display = 'none'; // Assicurati sia nascosto
             // startQuiz(); // TODO: Implementare e chiamare startQuiz
             questionDisplay.textContent = "Quiz non ancora implementato."; // Placeholder
             answersDisplay.innerHTML = ''; // Pulisci risposte precedenti
             startQuiz(); // <<<<<<< AVVIA IL QUIZ QUI
        }
    }

    // --- Gestione Immagini (Iniziale) --- //

    function handleImageUpload(event) {
        const fileInput = event.target;
        const group = fileInput.closest('.answer-edit-group');
        const preview = group.querySelector('.image-preview');
        const dataInput = group.querySelector('.answer-data');
        const textInput = group.querySelector('.answer-text-input');
        const file = fileInput.files[0];

        if (file) {
            if (file.size > 5 * 1024 * 1024) { // 5MB limite iniziale
                alert("L'immagine è troppo grande (max 5MB).");
                fileInput.value = ''; // Resetta input file
                return;
            }

            const reader = new FileReader();

            reader.onloadend = function() {
                const img = new Image();
                img.onload = function() {
                    // Ridimensiona e comprime l'immagine
                    const compressedDataUrl = resizeAndCompressImage(img, 800, 0.7); // Max 800px, 70% qualità
                    
                    // Mostra anteprima
                    preview.src = compressedDataUrl;
                    preview.style.display = 'block';
                    
                    // Salva Base64 compresso
                    dataInput.value = compressedDataUrl;
                    
                    // Mostra pulsante elimina immagine
                    const removeBtn = group.querySelector('.remove-answer-image-btn');
                    if (removeBtn) {
                        removeBtn.style.display = 'flex';
                    }
                    
                    // Pulisce l'input testuale
                    textInput.value = '';
                };
                
                img.src = reader.result;
            };

            reader.onerror = function(error) {
                console.error("[Errore] Caricamento immagine fallito:", error); // Ripristinato console.error
                alert("Errore nel caricamento dell'immagine.");
            };

            reader.readAsDataURL(file);
        }
    }

    // Funzione per ridimensionare e comprimere un'immagine tramite canvas
    function resizeAndCompressImage(imgElement, maxDimension, quality) {
        const canvas = document.createElement('canvas');
        let width = imgElement.width;
        let height = imgElement.height;
        
        // Calcola le nuove dimensioni mantenendo l'aspect ratio
        if (width > height && width > maxDimension) {
            height = Math.round(height * (maxDimension / width));
            width = maxDimension;
        } else if (height > maxDimension) {
            width = Math.round(width * (maxDimension / height));
            height = maxDimension;
        }
        
        // Imposta le dimensioni del canvas
        canvas.width = width;
        canvas.height = height;
        
        // Disegna l'immagine ridimensionata
        const ctx = canvas.getContext('2d');
        ctx.drawImage(imgElement, 0, 0, width, height);
        
        // Ritorna l'immagine compressa come dataURL (JPEG per migliore compressione)
        // Se l'originale era PNG con trasparenza, userà comunque JPEG per ridurre la dimensione
        return canvas.toDataURL('image/jpeg', quality);
    }

     // Aggiungi listener a ogni input file nell'editor
     answerEditGroups.forEach(group => {
         group.querySelector('.answer-image-input').addEventListener('change', handleImageUpload);
         // Listener per pulsante elimina immagine risposta
         const removeBtn = group.querySelector('.remove-answer-image-btn');
         if (removeBtn) {
             removeBtn.addEventListener('click', removeAnswerImage);
         }
         // Se l'utente scrive nel campo testo, cancella l'immagine associata
         group.querySelector('.answer-text-input').addEventListener('input', (e) => {
             const currentGroup = e.target.closest('.answer-edit-group');
             const preview = currentGroup.querySelector('.image-preview');
             const dataInput = currentGroup.querySelector('.answer-data');
             const fileInput = currentGroup.querySelector('.answer-image-input');
             const removeAnswerBtn = currentGroup.querySelector('.remove-answer-image-btn');
             if (e.target.value) { // Se c'è testo
                preview.src = '';
                preview.style.display = 'none';
                dataInput.value = e.target.value; // Aggiorna hidden input col testo
                fileInput.value = ''; // Resetta input file
                if (removeAnswerBtn) {
                    removeAnswerBtn.style.display = 'none';
                }
             }
         });
     });

    // --- Funzioni per eliminare immagini --- //
    function removeQuestionImage() {
        questionImageInput.value = '';
        questionImagePreview.src = '';
        questionImagePreview.style.display = 'none';
        questionImageDataInput.value = '';
        if (removeQuestionImageBtn) {
            removeQuestionImageBtn.style.display = 'none';
        }
    }

    function removeAnswerImage(event) {
        const group = event.target.closest('.answer-edit-group');
        if (!group) return;
        
        const preview = group.querySelector('.image-preview');
        const dataInput = group.querySelector('.answer-data');
        const fileInput = group.querySelector('.answer-image-input');
        const removeBtn = group.querySelector('.remove-answer-image-btn');
        const textInput = group.querySelector('.answer-text-input');
        
        // Reset immagine
        fileInput.value = '';
        preview.src = '';
        preview.style.display = 'none';
        dataInput.value = '';
        if (removeBtn) {
            removeBtn.style.display = 'none';
        }
        // Non pulisce il campo testo, così l'utente può inserire testo dopo aver rimosso l'immagine
    }

    // --- Aggiunta listener per immagine domanda --- //
    questionImageInput.addEventListener('change', handleQuestionImageUpload);
    if (removeQuestionImageBtn) {
        removeQuestionImageBtn.addEventListener('click', removeQuestionImage);
    }
    // Rimosso/Commentato listener che cancella l'immagine quando si scrive nel campo testo
    /*
    questionInput.addEventListener('input', (e) => {
        if (e.target.value) { // Se c'è testo
           questionImagePreview.src = '';
           questionImagePreview.style.display = 'none';
           questionImageDataInput.value = '';
           questionImageInput.value = ''; // Resetta input file
        }
    });
    */

    // --- Event Listeners --- //

    quizModeBtn.addEventListener('click', () => switchView(quizView));
    cardModeBtn.addEventListener('click', () => switchView(cardModeView));

    backToListBtn.addEventListener('click', () => {
        // Potremmo chiedere conferma se ci sono modifiche non salvate?
        showCardList();
        displayCardList(); // Ricarica la lista per sicurezza
    });

    saveCardBtn.addEventListener('click', handleSaveCard);

    // TODO: Aggiungere listener per deleteCardBtn
    deleteCardBtn.addEventListener('click', handleDeleteCard); // <<<<<<< LISTENER DELETE

    // TODO: Aggiungere listener per nextQuestionBtn, restartQuizBtn
    // TODO: Listener per selezione risposta nel quiz (da aggiungere dinamicamente)
    nextQuestionBtn.addEventListener('click', handleNextQuestion); // <<<<<<< LISTENER NEXT
    restartQuizBtn.addEventListener('click', startQuiz); // <<<<<<< LISTENER RESTART

    // --- Listener Aggiunti per Esporta/Importa --- //
    exportCardsBtn.addEventListener('click', exportCards);
    importCardsBtn.addEventListener('click', () => importFileInput.click()); // Apre la finestra di dialogo file
    importFileInput.addEventListener('change', handleImportFile);
    clearStorageBtn.addEventListener('click', clearAllCards);


    // --- Funzioni Logica Salvataggio --- //

    function handleSaveCard() {
        const questionText = questionInput.value.trim();
        const questionImage = questionImageDataInput.value.trim();
        const editingId = editingCardIdInput.value;
        let correctAnswerIndex = -1;
        const answers = [];

        // Validazione domanda: deve avere almeno testo o immagine
        if (!questionText && !questionImage) {
            alert("Inserisci il testo della domanda oppure carica un'immagine.");
            if (!questionText) {
                questionInput.focus();
            } else {
                questionImageInput.focus();
            }
            return;
        }

        // Raccogli e valida risposte
        let hasTextOrImageCount = 0;
        answerEditGroups.forEach((group, index) => {
            const textInput = group.querySelector('.answer-text-input');
            const dataInput = group.querySelector('.answer-data');
            const radio = group.querySelector('input[type="radio"]');
            const content = dataInput.value.trim();
            const isImage = content.startsWith('data:image');

            if (content) {
                 hasTextOrImageCount++;
                 answers.push({
                     type: isImage ? 'image' : 'text',
                     content: content
                 });
            } else {
                 answers.push(null);
            }

            if (radio.checked) {
                correctAnswerIndex = index;
            }
        });

        const validAnswers = answers.filter(a => a !== null);

        // Validazione numero minimo risposte
        if (validAnswers.length < 2) {
             alert("Inserisci almeno due risposte (testo o immagine).");
             return;
        }

        const finalAnswers = answers.filter(a => a !== null);

        // Riajusta correctAnswerIndex
        let adjustedCorrectAnswerIndex = -1;
        if (correctAnswerIndex !== -1) {
            const originalCorrectAnswer = answers[correctAnswerIndex];
            if(originalCorrectAnswer){
                adjustedCorrectAnswerIndex = finalAnswers.findIndex(a => a.content === originalCorrectAnswer.content && a.type === originalCorrectAnswer.type);
            }
        }

        // Validazione risposta corretta
        if (adjustedCorrectAnswerIndex === -1) {
            alert("Seleziona la risposta corretta tra quelle inserite.");
            return;
        }

        const cardData = {
            id: editingId || generateId(),
            questionText: questionText, // Salva il testo
            questionImage: questionImage, // Salva l'immagine (base64 o stringa vuota)
            answers: finalAnswers,
            correctAnswerIndex: adjustedCorrectAnswerIndex
        };

        if (editingId) {
            const indexToUpdate = cards.findIndex(card => card.id === editingId);
            if (indexToUpdate !== -1) {
                cards[indexToUpdate] = cardData;
            } else {
                 console.error("Fallback: Card da modificare non trovata, aggiunta come nuova. ID:", editingId);
                 cards.push(cardData);
            }
        } else {
            cards.push(cardData);
        }

        saveCards();
        showCardList();
        displayCardList();
    }

    // --- Funzioni Logica Quiz --- //

    function shuffleArray(array) {
        // Algoritmo Fisher-Yates (Knuth) Shuffle
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]]; // Scambia elementi
        }
        return array;
    }

    function startQuiz() {
        currentQuizCards = shuffleArray([...cards]);
        currentQuestionIndex = 0;
        score = 0;
        if (isGifModeActive) {
            currentGifDuration = 10; // Resetta durata all'inizio del quiz
        }

        quizContent.style.display = 'flex'; // 'flex': la colonna del quiz la disegna il CSS
        quizComplete.style.display = 'none';
        noCardsMessage.style.display = 'none';
        nextQuestionBtn.style.display = 'none'; // Nascondi bottone "Prossima" all'inizio

        if (currentQuizCards.length > 0) {
            displayQuestion();
        } else {
            // Caso strano, ma gestiamolo
             initializeQuizView(); // Torna alla gestione iniziale (mostrerà "no cards")
        }
    }

    function displayQuestion() {
        // Reset stile risposte precedenti
        answersDisplay.querySelectorAll('.answer-card').forEach(card => {
            card.classList.remove('correct', 'incorrect');
            card.onclick = null; // Rimuovi vecchi listener
        });

        // Pulisci il display della domanda precedente
        questionDisplay.innerHTML = '';

        if (currentQuestionIndex < currentQuizCards.length) {
            const card = currentQuizCards[currentQuestionIndex];

            // --- Visualizza Titolo e/o Immagine della Domanda --- //
            // Ogni domanda ha un titolo, e lo si mostra sempre: se c'e' anche
            // una figura, il titolo le sta sopra invece di sparire.
            if (card.questionText) {
                const questionTextDiv = document.createElement('div');
                questionTextDiv.className = 'question-title';
                questionTextDiv.textContent = card.questionText;
                questionDisplay.appendChild(questionTextDiv);
            }
            if (card.questionImage) {
                const img = document.createElement('img');
                img.src = card.questionImage;
                img.alt = card.questionText || "Immagine domanda";
                // Le misure le decide il foglio di stile: in linea vincerebbero
                // sempre loro e il quiz non potrebbe adattarsi allo schermo.
                questionDisplay.appendChild(img);
            }

            // --- Fine visualizzazione domanda --- //

            answersDisplay.innerHTML = ''; // Pulisci risposte

            // --- Mescola le risposte --- <<< MODIFICA QUI
            // Crea un array di oggetti { answer: ..., originalIndex: ... }
            const answersWithOriginalIndex = card.answers.map((answer, index) => ({
                answer: answer,
                originalIndex: index
            }));
            // Mescola l'array
            const shuffledAnswers = shuffleArray(answersWithOriginalIndex);
            // --- Fine mescola --- 

            // card.answers.forEach((answer, index) => { <<< VECCHIO CICLO
            shuffledAnswers.forEach((item) => { // <<< NUOVO CICLO SU ARRAY MESCOLATO
                const answer = item.answer;
                const originalIndex = item.originalIndex;

                const answerDiv = document.createElement('div');
                answerDiv.classList.add('card', 'answer-card');
                // answerDiv.dataset.index = index; // <<< VECCHIO DATASET
                answerDiv.dataset.originalIndex = originalIndex; // <<< NUOVO DATASET con indice originale

                if (answer.type === 'text') {
                    // La classe serve al foglio di stile: una risposta scritta
                    // deve crescere quanto una figura, non restare minuscola in
                    // mezzo a una card alta.
                    answerDiv.classList.add('answer-text');
                    answerDiv.textContent = answer.content;
                } else if (answer.type === 'image') {
                    const img = document.createElement('img');
                    img.src = answer.content; // Base64
                    img.alt = `Risposta`; // Modificato Alt text generico
                    // Niente misure in linea: le decide il foglio di stile.
                    answerDiv.appendChild(img);
                }

                // Aggiungi listener per la selezione
                // answerDiv.onclick = (event) => handleAnswerSelect(event, index); // <<< VECCHIO LISTENER
                answerDiv.onclick = (event) => handleAnswerSelect(event, originalIndex); // <<< NUOVO LISTENER con indice originale

                answersDisplay.appendChild(answerDiv);
            });

            nextQuestionBtn.style.display = 'none'; // Nascondi finché non si risponde
        } else {
            // Quiz finito
            showQuizResults();
        }
    }

     function handleAnswerSelect(event, originalSelectedIndex) { // <<< NUOVA FIRMA con indice originale
        const card = currentQuizCards[currentQuestionIndex];
        const correctAnswerIndex = card.correctAnswerIndex; // Questo è l'indice originale corretto
        const answerDivs = answersDisplay.querySelectorAll('.answer-card');
        const clickedDiv = event.target.closest('.answer-card'); // Memorizza il div cliccato

        // Disabilita ulteriori click
        answerDivs.forEach(div => div.onclick = null);

        // Controlla la risposta usando l'indice originale
        if (originalSelectedIndex === correctAnswerIndex) {
            score++;

            if (isGifModeActive && activeGifUrls.length > 0) {
                // --- Modalità GIF Attiva --- //
                console.log("Risposta corretta in GIF Mode!");
                clickedDiv.classList.add('correct'); // Mostra comunque feedback brevemente?
                // Pausa breve prima della GIF?
                setTimeout(() => {
                     if (currentGifDuration >= 1) {
                         showRandomGif();
                     }
                     currentGifDuration++; // Incrementa durata per la prossima volta
                }, 200); // Breve ritardo prima di mostrare la GIF
                return; // Impedisce di mostrare il pulsante "Next"

            } else {
                // --- Modalità Normale --- //
                clickedDiv.classList.add('correct');
                nextQuestionBtn.style.display = 'block'; // Mostra pulsante Prossima
            }

        } else {
             // --- Risposta Errata --- //
            if (isGifModeActive) {
                console.log("Risposta errata in GIF Mode, diminuisco durata di 10.");
                currentGifDuration = Math.max(1, currentGifDuration - 10); // Diminuisce durata di 10 secondi (minimo 1)
            }
            clickedDiv.classList.add('incorrect');
            // Evidenzia anche la risposta corretta
            answerDivs.forEach(div => {
                 if (parseInt(div.dataset.originalIndex) === correctAnswerIndex) {
                     div.classList.add('correct');
                 }
             });
             nextQuestionBtn.style.display = 'block'; // Mostra pulsante Prossima
        }

        // Mostra il pulsante "Prossima Domanda" (ora gestito nei blocchi if/else)
        // nextQuestionBtn.style.display = 'block';
    }

    function handleNextQuestion() {
         currentQuestionIndex++;
         if (currentQuestionIndex < currentQuizCards.length) {
             displayQuestion();
         } else {
             showQuizResults();
         }
    }

     function showQuizResults() {
        quizContent.style.display = 'none';
        quizComplete.style.display = 'block';
        finalScoreDisplay.textContent = score;
        totalQuestionsDisplay.textContent = currentQuizCards.length;
        console.log(`Quiz completato! Punteggio: ${score}/${currentQuizCards.length}`);
    }

    // --- Funzioni Esporta/Importa --- //

    function exportCards() {
        if (cards.length === 0) {
            alert("Non ci sono card da esportare.");
            return;
        }

        // Chiedi all'utente il nome del file
        const defaultFileName = 'flashcards_backup.json';
        const userFileName = prompt("Inserisci il nome del file (senza estensione):", defaultFileName.replace('.json', ''));
        
        if (userFileName === null) {
            // L'utente ha annullato
            return;
        }

        // Assicurati che il nome finisca con .json
        let fileName = userFileName.trim();
        if (!fileName) {
            fileName = defaultFileName.replace('.json', '');
        }
        if (!fileName.toLowerCase().endsWith('.json')) {
            fileName += '.json';
        }

        let dataStr;
        try {
            dataStr = JSON.stringify(cards, null, 2); // null, 2 per pretty print
        } catch (error) {
            console.error("Errore durante la serializzazione JSON:", error);
            alert("Si è verificato un errore nella preparazione dei dati da esportare.");
            return;
        }

        // Dentro il guscio Android un <a download> viene ignorato in silenzio:
        // e' il motivo per cui dalla vecchia app non si riusciva a esportare.
        // Qui si scrive il file davvero, tramite il plugin nativo.
        if (isCapacitorNative() && window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem) {
            window.Capacitor.Plugins.Filesystem.writeFile({
                path: fileName,
                data: dataStr,
                directory: 'DOCUMENTS',
                encoding: 'utf8',
                recursive: true
            }).then(function (res) {
                alert('Esportate ' + cards.length + ' card in:\n' + (res.uri || fileName));
            }).catch(function (err) {
                alert('Esportazione fallita: ' + err.message);
            });
            return;
        }

        // Crea un Blob con il contenuto JSON
        const blob = new Blob([dataStr], { type: 'application/json' });

        // Crea un URL temporaneo per il blob
        const url = URL.createObjectURL(blob);

        // Crea un link temporaneo e simula il click per il download
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();

        // Pulisci: rimuovi il link e revoca l'URL
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        console.log(`File ${fileName} scaricato con successo.`);
    }

    function handleImportFile(event) {
        const file = event.target.files[0];
        if (!file) {
            return; // Nessun file selezionato
        }

        // --- Gestione ZIP per GIF Mode --- //
        if (file.name.toLowerCase().endsWith('.zip')) {
            console.log("Rilevato file ZIP, tentativo caricamento GIF...");
            const zipReader = new FileReader();

            zipReader.onload = function(e_zip) {
                const zipData = e_zip.target.result;
                // Usa JSZip (assicurati sia inclusa nell'HTML)
                if (typeof JSZip === 'undefined') {
                    console.error("Libreria JSZip non trovata. Impossibile processare il file .zip.");
                    alert("Errore: Manca la libreria necessaria per gestire i file ZIP.");
                    event.target.value = null; // Resetta input
                    return;
                }

                cleanupGifUrls(); // Pulisci URL precedenti prima di caricarne nuovi
                const tempGifUrls = [];

                JSZip.loadAsync(zipData)
                    .then(zip => {
                        const gifPromises = [];
                        zip.forEach((relativePath, zipEntry) => {
                            // Considera solo file .gif (case-insensitive) e non in sottocartelle?
                            if (!zipEntry.dir && zipEntry.name.toLowerCase().endsWith('.gif')) {
                                console.log(`Trovata GIF nello ZIP: ${zipEntry.name}`);
                                gifPromises.push(
                                    zipEntry.async("blob")
                                        .then(blob => URL.createObjectURL(blob))
                                );
                            }
                        });
                        return Promise.all(gifPromises);
                    })
                    .then(urls => {
                        activeGifUrls = urls;
                        if (activeGifUrls.length > 0) {
                            activateGifMode();
                            switchView(cardModeView); // Torna alla vista card dopo import
                            showCardList();
                        } else {
                            console.log("File ZIP non conteneva GIF valide.");
                            alert("Il file ZIP selezionato non contiene immagini GIF valide.");
                            deactivateGifMode(); // Assicurati sia disattivata
                        }
                    })
                    .catch(error => {
                        console.error("Errore durante l'elaborazione del file ZIP:", error);
                        alert(`Si è verificato un errore leggendo il file ZIP: ${error.message}`);
                        deactivateGifMode();
                    })                    .finally(() => {
                        // Resetta l'input file indipendentemente dall'esito
                        event.target.value = null;
                    });
            };

             zipReader.onerror = function(error) {
                console.error("Errore lettura file ZIP:", error);
                alert("Si è verificato un errore durante la lettura del file ZIP.");
                event.target.value = null;
            };

            zipReader.readAsArrayBuffer(file);
            return; // Interrompi qui, non processare come JSON
        }

        // --- Se non è ZIP, processa come JSON (logica esistente) --- //
        console.log("File non ZIP, tentativo importazione JSON...");
        deactivateGifMode(); // Disattiva la modalità GIF se si importa un JSON

        const reader = new FileReader();

        reader.onload = function(e) {
            try {
                const fileContent = e.target.result.trim(); // Pulisce spazi bianchi extra!

                if (!fileContent) {
                     throw new Error("Il file selezionato sembra essere vuoto.");
                }

                const importedData = JSON.parse(fileContent);

                // Validazione base: è un array?
                if (!Array.isArray(importedData)) {
                    throw new Error("Il contenuto del file non è un array JSON valido come atteso.");
                }

                // Rimosso controllo sulla struttura della prima card per maggiore flessibilità
                /*
                if (importedData.length > 0 && (!importedData[0].id || !importedData[0].question || !importedData[0].answers)) {
                     console.warn("Il file importato sembra avere una struttura dati non standard, ma si tenta comunque l'importazione.");
                }
                */

                // Chiedi conferma prima di sovrascrivere (opzionale ma consigliato)
                if (cards.length > 0) {
                    if (!confirm("Attenzione: L'importazione sovrascriverà le card attuali. Continuare?")) {
                        // Resetta l'input file se l'utente annulla
                        event.target.value = null;
                        return;
                    }
                }

                cards = importedData; // Sovrascrivi le card attuali
                saveCards(); // Salva le nuove card nel localStorage
                displayCardList(); // Aggiorna la lista visualizzata
                switchView(cardModeView); // Assicurati che la vista gestione card sia attiva
                showCardList(); // Mostra la lista

                alert(`Importazione completata! ${cards.length} card caricate.`);

            } catch (error) {
                console.error("Errore durante l'importazione:", error);
                // Fornisce un messaggio più specifico
                let errorMessage = `Errore durante l'importazione: ${error.message}`;
                if (error instanceof SyntaxError) {
                    errorMessage = "Errore durante l'importazione: Il formato del file non è JSON valido. Assicurati che sia stato copiato e salvato correttamente senza modifiche.";
                }
                alert(errorMessage);
            } finally {
                 // Resetta l'input file per permettere di selezionare lo stesso file di nuovo
                 event.target.value = null;
            }
        };

        reader.onerror = function(error) {
            console.error("Errore lettura file:", error);
            alert("Si è verificato un errore durante la lettura del file.");
            // Resetta l'input file
            event.target.value = null;
        };

        reader.readAsText(file);
    }

    // --- Funzione Logica Eliminazione --- //

    function handleDeleteCard() {
        const editingId = editingCardIdInput.value;

        if (!editingId) {
            console.error("Tentativo di eliminare una card senza ID valido.");
            // Forse tornare indietro alla lista?
            showCardList();
            displayCardList();
            return;
        }

        // Chiedi conferma
        if (confirm("Sei sicuro di voler eliminare questa flashcard? L'azione non è reversibile.")) {
            const indexToDelete = cards.findIndex(card => card.id === editingId);

            if (indexToDelete !== -1) {
                cards.splice(indexToDelete, 1); // Rimuove la card dall'array
                saveCards(); // Salva le modifiche
                console.log("Card eliminata con ID:", editingId);
                alert("Flashcard eliminata con successo.");
            } else {
                console.error("Card da eliminare non trovata nell'array. ID:", editingId);
                alert("Errore: la card da eliminare non è stata trovata.");
            }

            // Torna alla lista in ogni caso dopo il tentativo
            showCardList();
            displayCardList();
        } else {
            // L'utente ha annullato
            console.log("Eliminazione annullata dall'utente.");
        }
    }

    // --- Funzioni GIF Mode --- //

    function activateGifMode() {
        console.log("Attivazione GIF Mode");
        isGifModeActive = true;
        currentGifDuration = 10; // Resetta durata all'attivazione
        currentGifDisplayQueue = [...activeGifUrls]; // Riempi la coda iniziale
        appContainer.classList.add('gif-mode-active');
    }

    function deactivateGifMode() {
        if (isGifModeActive) {
            console.log("Disattivazione GIF Mode");
            isGifModeActive = false;
            appContainer.classList.remove('gif-mode-active');
            cleanupGifUrls(); // Revoca gli URL non più necessari
            currentGifDisplayQueue = []; // Svuota la coda
        }
    }

    function cleanupGifUrls() {
        console.log(`Pulizia di ${activeGifUrls.length} URL GIF...`);
        activeGifUrls.forEach(url => URL.revokeObjectURL(url));
        activeGifUrls = [];
        currentGifDisplayQueue = []; // Assicurati che anche la coda sia pulita
    }

    function showRandomGif() {
        if (!isGifModeActive || activeGifUrls.length === 0 || currentGifDuration < 1) return;

        // Se la coda è vuota, riempila di nuovo
        if (currentGifDisplayQueue.length === 0) {
            console.log("Coda GIF vuota, ripopolo...");
            currentGifDisplayQueue = [...activeGifUrls];
        }

        // Scegli e rimuovi una GIF casuale dalla coda
        const queueIndex = Math.floor(Math.random() * currentGifDisplayQueue.length);
        const gifUrl = currentGifDisplayQueue.splice(queueIndex, 1)[0]; // Estrai la URL

        console.log(`Mostro GIF dalla coda: ${gifUrl} per ${currentGifDuration}s (rimanenti: ${currentGifDisplayQueue.length})`);

        gifDisplay.src = gifUrl;
        gifDurationDisplay.textContent = currentGifDuration;
        gifDurationDisplay.style.display = 'none'; // Nascosto inizialmente
        gifOverlay.style.display = 'flex'; // Mostra overlay

        // Mostra il numero solo durante l'ultimo secondo
        const showNumberTimeout = setTimeout(() => {
            gifDurationDisplay.style.display = 'block';
        }, (currentGifDuration - 1) * 1000);

        // Nascondi overlay e passa alla prossima domanda dopo la durata totale
        const hideOverlayTimeout = setTimeout(() => {
            gifOverlay.style.display = 'none';
            gifDisplay.src = ''; // Rimuovi sorgente per liberare memoria?
            gifDurationDisplay.style.display = 'none';
            // Cancella i timeout precedenti per sicurezza (anche se dovrebbero essere già scattati)
            clearTimeout(showNumberTimeout);
            handleNextQuestion(); // Passa automaticamente alla prossima
        }, currentGifDuration * 1000);
    }

    // --- Aggiunta Nuova Funzione ---
    function handleQuestionImageUpload(event) {
        console.log("handleQuestionImageUpload: Chiamata."); // LOG
        const fileInput = event.target;
        const preview = questionImagePreview;
        const dataInput = questionImageDataInput;
        const textInput = questionInput;
        const file = fileInput.files[0];

        if (file) {
            console.log(`handleQuestionImageUpload: File selezionato: ${file.name}, size: ${file.size}`); // LOG
            if (file.size > 5 * 1024 * 1024) {
                alert("L'immagine della domanda è troppo grande (max 5MB).");
                fileInput.value = '';
                return;
            }

            const reader = new FileReader();

            reader.onloadend = function() {
                console.log("handleQuestionImageUpload: reader.onloadend eseguito."); // LOG
                const img = new Image();
                img.onload = function() {
                    console.log("handleQuestionImageUpload: img.onload eseguito."); // LOG
                    try {
                        const compressedDataUrl = resizeAndCompressImage(img, 800, 0.7);
                        console.log("handleQuestionImageUpload: Immagine compressa."); // LOG
                        preview.src = compressedDataUrl;
                        preview.style.display = 'block';
                        dataInput.value = compressedDataUrl;
                        // Mostra pulsante elimina immagine
                        if (removeQuestionImageBtn) {
                            removeQuestionImageBtn.style.display = 'flex';
                        }
                        // Rimuovo la pulizia dell'input testuale della domanda
                        // textInput.value = '';
                        console.log("handleQuestionImageUpload: Anteprima e dati aggiornati."); // LOG
                    } catch (error) {
                         console.error("handleQuestionImageUpload: Errore durante resize/compressione:", error); // LOG
                         alert("Errore durante l'elaborazione dell'immagine.");
                    }
                };
                 img.onerror = function() { // Aggiunta gestione errore caricamento immagine
                    console.error("handleQuestionImageUpload: img.onerror eseguito. Impossibile caricare l'immagine dall'URL dati."); // LOG
                    alert("Si è verificato un errore nell'elaborazione dell'immagine dopo la lettura del file.");
                };

                img.src = reader.result;
                console.log("handleQuestionImageUpload: img.src impostato."); // LOG
            };

             reader.onerror = function(error) {
                console.error("[Errore] Caricamento immagine domanda fallito (reader.onerror):", error); // LOG
                alert("Errore nel caricamento dell'immagine della domanda.");
            };

            reader.readAsDataURL(file);
            console.log("handleQuestionImageUpload: reader.readAsDataURL chiamato."); // LOG
        } else {
             console.log("handleQuestionImageUpload: Nessun file selezionato."); // LOG
        }
    }

    // --- Inizializzazione --- //
    const buildTag = document.getElementById('build-tag');
    if (buildTag) buildTag.textContent = 'v' + APP_BUILD;
    loadCards();
    switchView(quizView); // Inizia con la vista Quiz

}); 