// بيانات مشروعك التي أرسلتها
const firebaseConfig = {
  apiKey: "AIzaSyDcbTGbnge1fgdEMT-hGv5_e4RHCXvUI34",
  authDomain: "medical-camera.firebaseapp.com",
  projectId: "medical-camera",
  storageBucket: "medical-camera.firebasestorage.app",
  messagingSenderId: "202098387719",
  appId: "1:202098387719:web:62f5a4cf9b9f63cdcaf3a2",
  measurementId: "G-HFVR2K0HVV"
};

// تشغيل Firebase مرة واحدة لكل الصفحات
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

