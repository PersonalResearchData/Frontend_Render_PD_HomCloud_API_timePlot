let uploadedFiles = [];

const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const fileListContainer = document.getElementById('fileListContainer');
const processBtn = document.getElementById('processBtn');

// --- Event Listeners for File Upload ---
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    uploadArea.addEventListener(eventName, e => {
        e.preventDefault();
        e.stopPropagation();
    }, false);
});
['dragenter', 'dragover'].forEach(eventName => {
    uploadArea.addEventListener(eventName, () => uploadArea.classList.add('dragover'), false);
});
['dragleave', 'drop'].forEach(eventName => {
    uploadArea.addEventListener(eventName, () => uploadArea.classList.remove('dragover'), false);
});

uploadArea.addEventListener('click', () => fileInput.click());
uploadArea.addEventListener('drop', (e) => handleFiles(e.dataTransfer.files));
fileInput.addEventListener('change', (e) => handleFiles(e.target.files));
processBtn.addEventListener('click', processFiles);

/**
 * Handles the selected files, updates the UI file list, and enables the process button.
 * @param {FileList} files - The files selected by the user.
 */
function handleFiles(files) {
    uploadedFiles = Array.from(files).filter(file => file.name.endsWith('.xyz'));
    fileListContainer.innerHTML = '';
    if (uploadedFiles.length > 0) {
        const list = document.createElement('div');
        uploadedFiles.forEach(file => {
            // Use Tailwind classes directly for the file item
            list.innerHTML += `
                <div class="bg-gray-100 p-3 rounded-lg flex justify-between items-center mb-2 text-sm">
                    <span class="font-medium text-gray-700 truncate">${file.name}</span>
                </div>
            `;
        });
        fileListContainer.appendChild(list);
        processBtn.disabled = false;
    } else {
        processBtn.disabled = true;
    }
}

/**
 * ファイル名から時刻情報を抽出
 * 様々なファイル名パターンに対応
 * @param {string} filename - ファイル名
 * @returns {number|null} - 抽出された時刻（タイムステップ）、見つからない場合はnull
 */
function extractTimestep(filename) {
    // 複数のパターンをチェック
    const patterns = [
        /output_timestep_(\d+)(?:_.*)?\.xyz$/,  // output_timestep_123.xyz
        /timestep_(\d+)\.xyz$/,                 // timestep_123.xyz
        /step_(\d+)\.xyz$/,                     // step_123.xyz
        /frame_(\d+)\.xyz$/,                    // frame_123.xyz
        /_(\d+)\.xyz$/,                         // anything_123.xyz
        /(\d+)\.xyz$/                           // 123.xyz
    ];
    
    for (const pattern of patterns) {
        const match = filename.match(pattern);
        if (match) {
            const timestep = parseInt(match[1]);
            console.log(`Extracted timestep ${timestep} from ${filename}`);
            return timestep;
        }
    }
    
    console.warn(`Could not extract timestep from ${filename}`);
    return null;
}

/**
 * タイムステップと設定からラベルを生成
 * @param {number|null} timestep - タイムステップ
 * @param {string} filename - ファイル名
 * @param {number} timestepSize - タイムステップサイズ（fs）
 * @returns {string} - 生成されたラベル
 */
function generateLabel(timestep, filename, timestepSize = 1.0) {
    if (timestep === null || timestep === undefined || !isFinite(timestep)) {
        return filename; // ファイル名をそのまま返す
    }
    
    // 時刻をフェムト秒で計算
    const timeFs = timestep * timestepSize;
    
    if (timestep === 0) {
        return "100 K, 0 fs";
    }
    
    // 適切な単位で表示
    if (timeFs < 1000) {
        return `40 K, ${timeFs.toFixed(0)} fs`;
    } else if (timeFs < 1000000) {
        const timePs = timeFs / 1000;
        return `40 K, ${timePs.toFixed(2)} ps`;
    } else {
        const timeNs = timeFs / 1000000;
        return `40 K, ${timeNs.toFixed(2)} ns`;
    }
}

/**
 * Sends the uploaded files to the backend API for PCA processing.
 */
async function processFiles() {
    if (uploadedFiles.length === 0) return;

    // ★★★ STEP 2: あなたのRender API URLに置き換えてください ★★★
    // const apiUrl = "https://your-service-name.onrender.com/process_pca";
    const apiUrl = "https://render-pd-homcloud-api-2.onrender.com";
    // ★★★ ========================================== ★★★

    if (apiUrl.includes("your-service-name")) {
        alert("スクリプト内の `apiUrl` をあなたのRenderサービスのURLに置き換えてください。");
        return;
    }

    document.getElementById('loading').style.display = 'block';
    document.getElementById('results').style.display = 'none';
    processBtn.disabled = true;

    const formData = new FormData();
    uploadedFiles.forEach(file => {
        formData.append('xyz_files', file);
    });

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            body: formData,
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'API request failed');
        }
        
        displayResults(data);

    } catch (error) {
        console.error('Error:', error);
        alert('An error occurred: ' + error.message);
    } finally {
        document.getElementById('loading').style.display = 'none';
        processBtn.disabled = false;
    }
}

/**
 * Displays the PCA results from the API.
 * @param {object} data - The result data from the API.
 */
function displayResults(data) {
    document.getElementById('results').style.display = 'block';
    
    displayStats(data);
    plotPCA(data);
    plotContributions(data);
    plotCumulative(data);
}

/**
 * Displays key statistics in summary cards.
 * @param {object} data - The result data from the API.
 */
function displayStats(data) {
    const statsGrid = document.getElementById('statsGrid');
    const expVar = data.explained_variance_ratio_all;
    statsGrid.innerHTML = `
        <div class="bg-white p-4 rounded-lg shadow text-center">
            <h3 class="text-2xl font-bold text-blue-600">${data.points.length}</h3>
            <p>Data Points</p>
        </div>
        <div class="bg-white p-4 rounded-lg shadow text-center">
            <h3 class="text-2xl font-bold text-blue-600">${(expVar[0] * 100).toFixed(1)}%</h3>
            <p>PC1 Variance</p>
        </div>
        <div class="bg-white p-4 rounded-lg shadow text-center">
            <h3 class="text-2xl font-bold text-blue-600">${(expVar.length > 1 ? expVar[1] * 100 : 0).toFixed(1)}%</h3>
            <p>PC2 Variance</p>
        </div>
        <div class="bg-white p-4 rounded-lg shadow text-center">
            <h3 class="text-2xl font-bold text-blue-600">${(data.cumulative_variance_ratio_all[1] * 100).toFixed(1)}%</h3>
            <p>PC1+PC2 Cum. Var.</p>
        </div>
    `;
}

/**
 * Renders the 2D PCA scatter plot using Plotly.
 * @param {object} data - The result data from the API.
 */
function plotPCA(data) {
    // ファイル名からタイムステップを抽出してカラー値を計算
    const colorValues = [];
    const colorBarTitle = 'Time';
    const timestepSize = 1.0; // デフォルトのタイムステップサイズ（必要に応じて調整）
    
    // 各ポイントのラベルを改善
    const improvedLabels = data.points.map((point, index) => {
        const originalLabel = point.label;
        
        // ファイル名からタイムステップを抽出
        const timestep = extractTimestep(originalLabel);
        const improvedLabel = generateLabel(timestep, originalLabel, timestepSize);
        
        // カラー値の計算
        if (timestep !== null && isFinite(timestep)) {
            const timeFs = timestep * timestepSize;
            // ピコ秒に変換してカラー値として使用
            colorValues.push(timeFs / 1000); // ps単位
        } else {
            // タイムステップが抽出できない場合はインデックスを使用
            colorValues.push(index);
        }
        
        return improvedLabel;
    });
    
    // カラー値の範囲に基づいて適切な単位を決定
    const maxColorValue = Math.max(...colorValues);
    let displayColorValues = [...colorValues];
    let finalColorBarTitle = 'Time (ps)';
    
    if (maxColorValue < 1) {
        // 1ps未満の場合はfs表示
        displayColorValues = colorValues.map(v => v * 1000);
        finalColorBarTitle = 'Time (fs)';
    } else if (maxColorValue > 1000) {
        // 1000ps以上の場合はns表示
        displayColorValues = colorValues.map(v => v / 1000);
        finalColorBarTitle = 'Time (ns)';
    }

    const trace = {
        x: data.points.map(p => p.x),
        y: data.points.map(p => p.y),
        mode: 'markers+text',
        type: 'scatter',
        text: data.points.map((_, i) => `${i+1}`), // ポイント番号を表示
        textposition: 'top center',
        textfont: {
            size: 10,
            color: 'white'
        },
        marker: {
            size: 16,
            color: displayColorValues,
            colorscale: [
                [0, '#440154'],    // Dark purple (early times)
                [0.2, '#31688e'], // Dark blue
                [0.4, '#35b779'], // Green
                [0.6, '#fde725'], // Yellow
                [0.8, '#fd9731'], // Orange
                [1, '#cc4778']    // Pink-red (late times)
            ],
            colorbar: { 
                title: {
                    text: finalColorBarTitle,
                    font: { size: 14 }
                },
                thickness: 15,
                len: 0.7
            },
            line: {
                width: 2,
                color: 'white'
            }
        },
        hovertemplate: '<b>%{customdata}</b><br>' +
                      'PC1: %{x:.3f}<br>' +
                      'PC2: %{y:.3f}<br>' +
                      finalColorBarTitle.replace('Time ', '') + ': %{marker.color:.2f}<br>' +
                      '<b>Click to view details</b><br>' +
                      '<extra></extra>',
        customdata: improvedLabels
    };
    
    const layout = {
        xaxis: { 
            title: `PC1 (${(data.explained_variance_ratio_all[0] * 100).toFixed(2)}%)`,
            gridcolor: '#f0f0f0'
        },
        yaxis: { 
            title: `PC2 (${(data.explained_variance_ratio_all[1] * 100).toFixed(2)}%)`,
            gridcolor: '#f0f0f0'
        },
        hovermode: 'closest',
        plot_bgcolor: 'white',
        paper_bgcolor: 'white',
        font: { family: 'Inter, Arial, sans-serif' },
        title: {
            text: 'Click on any point to view details',
            font: { size: 14, color: '#666' },
            x: 0.5
        },
        margin: { l: 60, r: 80, b: 50, t: 50 }
    };
    
    const config = { 
        responsive: true,
        displayModeBar: true,
        modeBarButtonsToRemove: ['select2d', 'lasso2d']
    };

    Plotly.newPlot('pcaPlot', [trace], layout, config);
    
    // クリックイベントリスナーを追加
    document.getElementById('pcaPlot').on('plotly_click', function(eventData) {
        if (eventData.points && eventData.points.length > 0) {
            const pointIndex = eventData.points[0].pointIndex;
            const pointData = data.points[pointIndex];
            const improvedLabel = improvedLabels[pointIndex];
            
            // クリックされたポイントの詳細を表示
            alert(`Point ${pointIndex + 1}:\n${improvedLabel}\nPC1: ${pointData.x.toFixed(3)}\nPC2: ${pointData.y.toFixed(3)}`);
        }
    });
}

/**
 * Renders the principal component contribution bar chart.
 * @param {object} data - The result data from the API.
 */
function plotContributions(data) {
    const components = data.explained_variance_ratio_all.map((_, i) => `PC${i+1}`);
    const trace = {
        x: components,
        y: data.explained_variance_ratio_all,
        type: 'bar',
        marker: { color: '#3b82f6' },
        text: data.explained_variance_ratio_all.map(v => `${(v * 100).toFixed(2)}%`),
        textposition: 'auto'
    };
    const layout = {
        xaxis: { title: 'Principal Component' },
        yaxis: { title: 'Explained Variance Ratio' },
        margin: { l: 60, r: 30, b: 50, t: 30 },
        font: { family: 'Inter, Arial, sans-serif' }
    };
    Plotly.newPlot('contributionPlot', [trace], layout, {responsive: true});
}

/**
 * Renders the cumulative variance line chart.
 * @param {object} data - The result data from the API.
 */
function plotCumulative(data) {
    const components = data.cumulative_variance_ratio_all.map((_, i) => `PC${i+1}`);
    const trace = {
        x: components,
        y: data.cumulative_variance_ratio_all,
        type: 'scatter',
        mode: 'lines+markers',
        marker: { color: '#16a34a', size: 8 },
        line: { color: '#16a34a', width: 3 },
        text: data.cumulative_variance_ratio_all.map(v => `${(v * 100).toFixed(2)}%`),
        textposition: 'top center'
    };
    const layout = {
        xaxis: { title: 'Principal Component' },
        yaxis: { title: 'Cumulative Variance Ratio', range: [0, 1.1] },
        margin: { l: 60, r: 30, b: 50, t: 30 },
        font: { family: 'Inter, Arial, sans-serif' }
    };
    Plotly.newPlot('cumulativePlot', [trace], layout, {responsive: true});
}
