/**
 * CÓDIGO DO GOOGLE APPS SCRIPT PARA A ONG "MIADOS E LATIDOS"
 */

const SHEET_NAME_PRODUCTS = "Estoque";
const SHEET_NAME_SALES = "Vendas";

function setupSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  if (!ss.getSheetByName(SHEET_NAME_PRODUCTS)) {
    const sheet = ss.insertSheet(SHEET_NAME_PRODUCTS);
    sheet.appendRow(["ID", "Nome", "Tamanho", "Cor", "Preço", "Estoque", "Foto_URL"]);
  }
  
  if (!ss.getSheetByName(SHEET_NAME_SALES)) {
    const sheet = ss.insertSheet(SHEET_NAME_SALES);
    sheet.appendRow(["ID_Venda", "Data_Hora", "Metodo", "Total", "Itens_JSON"]);
  }
}

// Retorna Produtos e Vendas
function doGet(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Lê Produtos
  const sheetProd = ss.getSheetByName(SHEET_NAME_PRODUCTS);
  let products = [];
  if (sheetProd) {
    const dataP = sheetProd.getDataRange().getValues();
    const headP = dataP[0];
    for (let i = 1; i < dataP.length; i++) {
        let p = {};
        for(let j=0; j<headP.length; j++) {
            let k = headP[j].toLowerCase();
            p[k] = dataP[i][j];
        }
        products.push(p);
    }
  }

  // Lê Vendas
  const sheetSales = ss.getSheetByName(SHEET_NAME_SALES);
  let sales = [];
  if (sheetSales) {
    const dataS = sheetSales.getDataRange().getValues();
    for (let i = 1; i < dataS.length; i++) {
        sales.push({
            id: String(dataS[i][0]),
            data_hora: dataS[i][1],
            metodo: dataS[i][2],
            total: dataS[i][3],
            itens: JSON.parse(dataS[i][4] || "[]")
        });
    }
  }
  
  return ContentService.createTextOutput(JSON.stringify({products: products, sales: sales}))
    .setMimeType(ContentService.MimeType.JSON);
}

// Recebe requisições
function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // 1. REGISTRAR VENDA
    if (payload.action === "sale") {
      const sheet = ss.getSheetByName(SHEET_NAME_SALES);
      sheet.appendRow([
        payload.sale.id,
        payload.sale.data_hora,
        payload.sale.metodo,
        payload.sale.total,
        JSON.stringify(payload.sale.itens)
      ]);
      
      // Atualizar Estoque (-)
      atualizarEstoqueLista(ss, payload.sale.itens, false);
      return success("Venda registrada");
      
    // 2. EXCLUIR VENDA
    } else if (payload.action === "delete_sale") {
      const sheet = ss.getSheetByName(SHEET_NAME_SALES);
      const dataS = sheet.getDataRange().getValues();
      for(let i=1; i<dataS.length; i++) {
         if(String(dataS[i][0]) === String(payload.id)) {
             // Devolve o estoque
             const itensJson = JSON.parse(dataS[i][4] || "[]");
             atualizarEstoqueLista(ss, itensJson, true);
             
             // Apaga a linha da venda
             sheet.deleteRow(i + 1);
             return success("Venda apagada e estoque retornado");
         }
      }
      return success("Venda não encontrada");

    // 3. ADICIONAR / EDITAR PRODUTO
    } else if (payload.action === "save_product") {
       const sheet = ss.getSheetByName(SHEET_NAME_PRODUCTS);
       const p = payload.product;
       const dataP = sheet.getDataRange().getValues();
       let found = false;
       for(let i=1; i<dataP.length; i++) {
           if(String(dataP[i][0]) === String(p.id)) {
               // Atualiza Linha
               sheet.getRange(i+1, 1, 1, 7).setValues([[p.id, p.nome, p.tamanho, p.cor, p.preco, p.estoque, p.foto_url]]);
               found = true; break;
           }
       }
       if(!found) {
           sheet.appendRow([p.id, p.nome, p.tamanho, p.cor, p.preco, p.estoque, p.foto_url]);
       }
       return success("Produto salvo");
    }
    
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({status: "error", message: err.message}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Função auxiliar de estoque (returnToStock = true -> soma, false -> diminui)
function atualizarEstoqueLista(ss, itensArray, returnToStock) {
   const stockSheet = ss.getSheetByName(SHEET_NAME_PRODUCTS);
   const stockData = stockSheet.getDataRange().getValues();
   const headers = stockData[0];
   const idIndex = headers.indexOf("ID");
   const qtIndex = headers.indexOf("Estoque");
   
   itensArray.forEach(item => {
      for (let i = 1; i < stockData.length; i++) {
         if (String(stockData[i][idIndex]) === String(item.id)) {
            const currentStock = stockSheet.getRange(i + 1, qtIndex + 1).getValue();
            let newStock = returnToStock ? (currentStock + item.quantidade) : (currentStock - item.quantidade);
            stockSheet.getRange(i + 1, qtIndex + 1).setValue(newStock);
         }
      }
   });
}

function success(msg) {
    return ContentService.createTextOutput(JSON.stringify({status: "success", message: msg}))
        .setMimeType(ContentService.MimeType.JSON);
}
