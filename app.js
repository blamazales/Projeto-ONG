// Estado Global
let products = [];
let sales = [];
let apiUrl = localStorage.getItem('ong_api_url') || "";

// Mock Local Temporário
const mockProducts = [
    { id: '1', nome: 'Ratinho', tamanho: 'Único', cor: 'Sortido', preco: 5.00, estoque: 15, foto_url: '' },
    { id: '2', nome: 'Necessaire', tamanho: 'P', cor: 'Várias', preco: 40.00, estoque: 8, foto_url: '' }
];

// Inicia a aplicação
async function initApp() {
    setupNavigation();
    setupSettings();
    setupProductForm();
    setupSaleForm();
    
    // Atualiza campo de configuração
    document.getElementById('api-url-input').value = apiUrl;
    
    await fetchData();
}

// Navegação
function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item[data-target]');
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            navItems.forEach(n => n.classList.remove('active'));
            item.classList.add('active');
            
            document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
            document.getElementById(item.getAttribute('data-target')).classList.remove('hidden');
        });
    });
}

// Configurações
function setupSettings() {
    document.getElementById('save-config-btn').addEventListener('click', () => {
        const url = document.getElementById('api-url-input').value.trim();
        if(url) {
            localStorage.setItem('ong_api_url', url);
            apiUrl = url;
            showToast('Configuração Salva!', 'success');
            fetchData();
        }
    });
}

// Modais
function closeModal(modalId) {
    document.getElementById(modalId).classList.add('hidden');
}
function openProductModal() {
    document.getElementById('product-form').reset();
    document.getElementById('prod-id').value = '';
    document.getElementById('product-modal').classList.remove('hidden');
}
function openSaleModal() {
    document.getElementById('sale-form').reset();
    populateSaleProductSelect();
    document.getElementById('sale-modal').classList.remove('hidden');
}

// Preenche o Select da Nova Venda
function populateSaleProductSelect() {
    const select = document.getElementById('sale-product-select');
    select.innerHTML = '<option value="">-- Selecione o Produto --</option>';
    products.forEach(p => {
        select.innerHTML += `<option value="${p.id}" data-price="${p.preco}">${p.nome} (${p.cor} / ${p.tamanho}) - R$ ${parseFloat(p.preco).toFixed(2).replace('.',',')}</option>`;
    });

    // Auto atualiza o valor total ao escolher qtd ou item
    select.addEventListener('change', autoCalcSaleTotal);
    document.getElementById('sale-qty').addEventListener('input', autoCalcSaleTotal);
}

function autoCalcSaleTotal() {
    const select = document.getElementById('sale-product-select');
    const qty = document.getElementById('sale-qty').value;
    const opt = select.options[select.selectedIndex];
    if(opt && opt.value) {
        const price = opt.getAttribute('data-price');
        document.getElementById('sale-total').value = (parseFloat(price) * parseInt(qty || 1)).toFixed(2);
    }
}

// Form Produto
function setupProductForm() {
    document.getElementById('product-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const pd = {
            id: document.getElementById('prod-id').value || Date.now().toString(),
            nome: document.getElementById('prod-name').value,
            tamanho: document.getElementById('prod-size').value,
            cor: document.getElementById('prod-color').value,
            preco: parseFloat(document.getElementById('prod-price').value),
            estoque: parseInt(document.getElementById('prod-stock').value),
            foto_url: document.getElementById('prod-image').value
        };

        const idx = products.findIndex(p => p.id == pd.id);
        if(idx >= 0) products[idx] = pd;
        else products.push(pd);
        
        closeModal('product-modal');
        renderStock(products);
        
        await syncBackend({ action: 'save_product', product: pd });
        showToast('Produto salvo no estoque!');
    });
}

// Form Venda
function setupSaleForm() {
    document.getElementById('sale-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const prodId = document.getElementById('sale-product-select').value;
        if(!prodId) return showToast('Selecione um produto', 'error');
        
        const qty = parseInt(document.getElementById('sale-qty').value);
        const method = document.getElementById('sale-method').value;
        const total = parseFloat(document.getElementById('sale-total').value);
        
        // Verifica estoque
        const p = products.find(prod => prod.id === prodId);
        if(!p || p.estoque < qty) {
            return showToast('Estoque insuficiente para esta quantidade.', 'error');
        }

        const salePayload = {
            id: Date.now().toString(),
            data_hora: new Date().toISOString(),
            metodo: method,
            total: total,
            itens: [{ id: prodId, quantidade: qty }]
        };

        p.estoque -= qty; // Abate local
        sales.push(salePayload);
        
        closeModal('sale-modal');
        renderStock(products);
        renderSales(sales);
        showToast('Venda lançada e estoque reduzido!');
        
        await syncBackend({ action: 'sale', sale: salePayload });
    });
}

// Buscas no Backend (Google Sheets)
async function fetchData() {
    showLoader(true);
    if (!apiUrl) {
        products = [...mockProducts];
        sales = [];
        renderStock(products);
        renderSales(sales);
        showLoader(false);
        return;
    }

    try {
        const res = await fetch(apiUrl);
        const data = await res.json();
        if(data && data.products) {
            products = data.products;
            sales = data.sales || [];
            renderStock(products);
            renderSales(sales);
        }
    } catch(e) {
        showToast('Erro ao sincronizar com servidor', 'error');
    }
    showLoader(false);
}

async function syncBackend(payload) {
    if(!apiUrl) return;
    showLoader(true);
    try {
        await fetch(apiUrl, { method: 'POST', body: JSON.stringify(payload) });
        // Traz as infos atualizadas por garantia
        await fetchData();
    } catch(e) {
        showToast('Falha na comunicação', 'error');
    }
    showLoader(false);
}

// Renderizadores
function renderStock(items) {
    const tbody = document.getElementById('stock-table-body');
    tbody.innerHTML = '';
    items.forEach(p => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <strong>${p.nome}</strong><br>
                <small>${p.cor} | ${p.tamanho}</small>
            </td>
            <td><strong>${p.estoque}</strong> un.</td>
            <td>R$ ${parseFloat(p.preco).toFixed(2).replace('.',',')}</td>
        `;
        tbody.appendChild(tr);
    });
}

function renderSales(items) {
    const tbody = document.getElementById('sales-table-body');
    tbody.innerHTML = '';
    
    // Mostra as mais novas primeiro
    items.slice().reverse().forEach(s => {
        const tr = document.createElement('tr');
        const dt = new Date(s.data_hora).toLocaleString('pt-BR');
        tr.innerHTML = `
            <td>
                <strong>#${s.id.slice(-6)}</strong><br>
                <small>${dt}</small>
            </td>
            <td>R$ ${parseFloat(s.total).toFixed(2).replace('.',',')}<br><small>${s.metodo}</small></td>
            <td>
                <button class="icon-btn" onclick="deleteSale('${s.id}')" style="color:var(--danger)"><i class="fa-solid fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function deleteSale(id) {
    if(!confirm("Atenção: Excluir esta venda fará com que os produtos sejam DEVOLVIDOS ao controle de estoque. Continuar?")) return;
    
    // Deleta localmente
    const saleIdx = sales.findIndex(s => s.id === id);
    if(saleIdx > -1) {
        const sale = sales[saleIdx];
        sale.itens.forEach(item => {
            const p = products.find(prod => String(prod.id) === String(item.id));
            if(p) p.estoque += item.quantidade;
        });
        sales.splice(saleIdx, 1);
        renderSales(sales);
        renderStock(products);
    }
    
    await syncBackend({ action: 'delete_sale', id: id });
    showToast('Venda excluída. Estoque estornado.');
}

// Utils
function showLoader(show) { document.getElementById('loading-overlay').classList.toggle('hidden', !show); }
function showToast(msg, type='success') {
    const toast = document.createElement('div');
    toast.className = 'toast'; 
    toast.style.background = type === 'error' ? 'var(--danger)' : 'var(--primary)';
    toast.textContent = msg;
    document.getElementById('toast-container').appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// Start
initApp();
