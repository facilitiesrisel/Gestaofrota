import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import "firebase/compat/firestore";

// Configurações do ambiente de produção original (onde residem os dados reais do usuário)
const prodConfig = {
  apiKey: "AIzaSyAwJbdeYAfTq7q9z-W4UDz_l16rOfpF8j0",
  authDomain: "clean-sector-477820-u3.firebaseapp.com",
  projectId: "clean-sector-477820-u3",
  storageBucket: "clean-sector-477820-u3.firebasestorage.app",
  messagingSenderId: "118025464399",
  appId: "1:118025464399:web:374f42e4b27c887701d83a",
  measurementId: "G-L552DCBRHY"
};

// Configurações do ambiente de sandbox gerenciado pelo AI Studio
let sandboxConfig = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: "",
  measurementId: ""
};

// Tenta ler o arquivo de sandbox se existir
try {
  // @ts-ignore
  import("../firebase-applet-config.json").then((config: any) => {
    sandboxConfig = {
      apiKey: config.default.apiKey,
      authDomain: config.default.authDomain,
      projectId: config.default.projectId,
      storageBucket: config.default.storageBucket,
      messagingSenderId: config.default.messagingSenderId,
      appId: config.default.appId,
      measurementId: config.default.measurementId || ""
    };
  }).catch(() => {});
} catch (e) {}

// Determina o ambiente ativo (padrão é produção para recuperar o histórico)
let activeEnv = "production";
if (typeof window !== "undefined") {
  const savedEnv = window.localStorage.getItem("custom_firebase_project");
  if (savedEnv) {
    activeEnv = savedEnv;
  } else {
    // Inicializa localmente caso não esteja definido
    window.localStorage.setItem("custom_firebase_project", "production");
  }
}

const firebaseConfig = activeEnv === "sandbox" ? sandboxConfig : prodConfig;

// Initialize Firebase
const app = !firebase.apps.length ? firebase.initializeApp(firebaseConfig) : firebase.app();

// Initialize and export Firebase services
export const auth = firebase.auth();

// Determina se conectamos ao banco padrão do projeto ou ao banco dedicado do sandbox
export const activeDatabaseId = activeEnv === "sandbox" && (sandboxConfig as any).firestoreDatabaseId
  ? (sandboxConfig as any).firestoreDatabaseId
  : "(default)";

let firestoreInstance;
try {
  firestoreInstance = activeDatabaseId !== "(default)"
    ? (app as any).firestore(activeDatabaseId)
    : app.firestore();
} catch (e) {
  console.error("Erro ao inicializar Firestore com databaseId. Usando (default).", e);
  firestoreInstance = app.firestore();
}

export const db = firestoreInstance;

export { firebaseConfig, activeEnv };
export default app;
