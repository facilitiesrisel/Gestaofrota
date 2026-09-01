
/**
 * Serviço de Integração com API Veloe Abastecimento
 * Baseado no Manual de Integração API fuel-supply-data Versão 1.4.0
 */

// --- CONFIGURAÇÃO DE CREDENCIAIS ---
// PREENCHA AQUI COM SEUS DADOS REAIS PARA ATIVAR A API
// Se estas variáveis estiverem vazias, o sistema usará o modo SIMULAÇÃO (Mock).

const VELOE_CLIENT_ID = (typeof process !== "undefined" && process.env ? process.env.REACT_APP_VELOE_CLIENT_ID : "") || ""; 
const VELOE_CLIENT_SECRET = (typeof process !== "undefined" && process.env ? process.env.REACT_APP_VELOE_CLIENT_SECRET : "") || "";
const VELOE_CONTRACT_ID = (typeof process !== "undefined" && process.env ? process.env.REACT_APP_VELOE_CONTRACT_ID : "") || ""; 

// Endpoint base Produção
const BASE_URL = 'https://api.alelo.com.br/alelo/prd/auto/partner/api/fuel-supply-data';

// --- INTERFACES ---

export interface VeloeTransaction {
    corporateName: string;
    vehiclePlate: string;
    vehicleModel: string;
    costCenter: string;
    driverName: string;
    registry: string;
    card: string;
    fuelType: string;
    amountLiters: string; // Vem como string da API, ex: "45,50"
    unitValue: string;
    stockedValue: string; // Valor total da transação
    cardBalance: string; // Saldo do cartão
    transactionDate: string; // formato "dd/MM/yyyy HH:mm:ss"
    authorization: string;
    transactionStatus: string;
    supplyLocation: string; // Nome do posto
    network: string; // Bandeira
    odometer: string;
    kmTraveled: string;
}

// --- SERVIÇO ---

/**
 * Autentica na API da Veloe e retorna o token de acesso.
 * @returns accessToken string
 */
const authenticate = async (): Promise<string> => {
    // Se não houver credenciais, retorna token falso para mock
    if (!VELOE_CLIENT_ID || !VELOE_CLIENT_SECRET) return 'mock_token_123';

    try {
        // Ajuste conforme documentação padrão OAuth Alelo/Veloe
        const response = await fetch(`${BASE_URL}/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-ibm-client-id': VELOE_CLIENT_ID,
                'x-ibm-client-secret': VELOE_CLIENT_SECRET,
                // Algumas versões da API exigem o ClientId também no header padrão
                'ClientId': VELOE_CLIENT_ID 
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Falha na autenticação Veloe (${response.status}): ${errorText}`);
        }
        
        const data = await response.json();
        // Geralmente o token vem em 'body.accessToken' ou 'access_token' dependendo da versão
        return data.body?.accessToken || data.access_token;
    } catch (error) {
        console.error("Veloe Auth Error:", error);
        throw error;
    }
};

/**
 * Busca o histórico de abastecimento para uma lista de placas em um determinado período.
 */
export const getSupplyHistory = async (
    vehiclePlates: string[], 
    startDate: Date, 
    endDate: Date
): Promise<VeloeTransaction[]> => {
    // Formatação de data requerida: dd/MM/yyyy
    const formatDate = (d: Date) => d.toLocaleDateString('pt-BR');

    // MODO MOCK: Se não tiver credenciais, usa gerador
    if (!VELOE_CLIENT_ID || !VELOE_CLIENT_SECRET || !VELOE_CONTRACT_ID) {
        console.warn("Veloe Service: Modo SIMULAÇÃO (Credenciais não configuradas).");
        return generateMockData(vehiclePlates, startDate, endDate);
    }

    try {
        const token = await authenticate();
        
        const response = await fetch(`${BASE_URL}/v1/supply-history-anp/contract/${VELOE_CONTRACT_ID}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'x-ibm-client-id': VELOE_CLIENT_ID,
                'x-ibm-client-secret': VELOE_CLIENT_SECRET
            },
            body: JSON.stringify({
                vehiclePlates: vehiclePlates,
                startDate: formatDate(startDate),
                endDate: formatDate(endDate),
                // transactionStatus: "Aprovada" // Opcional, removemos para trazer tudo
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Veloe API Error (${response.status}): ${errText}`);
        }

        const json = await response.json();
        return json.body || [];

    } catch (error) {
        console.error("Veloe Fetch Error:", error);
        // Em caso de erro real de conexão, podemos retornar array vazio ou lançar erro
        // Para evitar travar a tela, retornamos vazio e logamos o erro
        return [];
    }
};


// --- GERADOR DE DADOS MOCK (SIMULAÇÃO DETERMINÍSTICA) ---
// Usado apenas se as credenciais não forem preenchidas
const generateMockData = (plates: string[], start: Date, end: Date): VeloeTransaction[] => {
    const transactions: VeloeTransaction[] = [];
    const now = new Date();

    if (start > now) return []; 
    const effectiveEnd = end > now ? now : end;
    const daysDiff = Math.ceil((effectiveEnd.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff <= 0) return [];

    // Saldos fixos para teste visual quando em modo Mock
    const MOCK_FIXED_BALANCES: Record<string, string> = {
        'SUF8D94': '287,18',
    };

    plates.forEach(plate => {
        const cleanPlate = plate.toUpperCase().replace(/[^A-Z0-9]/g, '');
        
        let fixedBalance = MOCK_FIXED_BALANCES[cleanPlate];
        if (!fixedBalance) {
            const seed = cleanPlate.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
            const generatedBalance = 100 + (seed * 17 % 2500); 
            fixedBalance = generatedBalance.toFixed(2).replace('.', ',');
        }

        const numEvents = Math.floor(Math.random() * 3) + 1; 

        for (let i = 0; i < numEvents; i++) {
            const randomDayOffset = Math.floor(Math.random() * daysDiff);
            const date = new Date(start);
            date.setDate(date.getDate() + randomDayOffset);
            date.setHours(7 + Math.floor(Math.random() * 12), Math.floor(Math.random() * 60));

            if (date > now) continue;

            const litersVal = 30 + Math.random() * 30;
            const liters = litersVal.toFixed(2);
            const price = 5.59;
            const totalVal = litersVal * price;
            const total = totalVal.toFixed(2);
            const efficiency = 8 + Math.random() * 4; 
            const kmTraveledVal = Math.round(litersVal * efficiency);
            const odometer = 45000 + (kmTraveledVal * i); 

            transactions.push({
                corporateName: "RISEL COMBUSTIVEIS LTDA",
                vehiclePlate: plate,
                vehicleModel: "VEICULO FROTA",
                costCenter: "001",
                driverName: "CONDUTOR FROTA",
                registry: "123456",
                card: "5060********1234",
                fuelType: "GASOLINA COMUM",
                amountLiters: liters.replace('.', ','),
                unitValue: price.toFixed(2).replace('.', ','),
                stockedValue: total.replace('.', ','),
                cardBalance: fixedBalance,
                transactionDate: date.toLocaleString('pt-BR'),
                authorization: Math.floor(Math.random() * 99999).toString(),
                transactionStatus: "APROVADA",
                supplyLocation: "POSTO CREDENCIADO",
                network: "VELOE",
                odometer: odometer.toFixed(0),
                kmTraveled: kmTraveledVal.toString()
            });
        }
    });

    return transactions.sort((a, b) => {
        const parse = (s: string) => {
            const [d, m, y, h, min, sec] = s.split(/[\/\s:]/);
            return new Date(Number(y), Number(m)-1, Number(d), Number(h), Number(min), Number(sec)).getTime();
        };
        return parse(b.transactionDate) - parse(a.transactionDate);
    });
};
