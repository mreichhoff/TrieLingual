import { initializeApp } from "firebase/app";
import { getAuth, signOut, onAuthStateChanged, GoogleAuthProvider, signInWithRedirect } from "firebase/auth";
import { getFunctions, httpsCallable, connectFunctionsEmulator } from "firebase/functions";

const signinButton = document.getElementById('signin-button');
const signoutButton = document.getElementById('signout-button');
const welcomeMessage = document.getElementById('welcome-message');
const userAccountItem = document.getElementById('user-account-item');
const loginContainer = document.querySelector('.login-container');
const loginBackLink = document.querySelector('.login-back-link');
const signinWithGoogle = document.getElementById('signin-with-google');
const mainContainer = document.getElementById('main-container');
const menuContainer = document.getElementById('menu-container');

const firebaseConfig = {
    apiKey: "AIzaSyCrDBfpFTmZvmiRahaGb8hepqDjgYzJThg",
    authDomain: "trielingual.com",
    databaseURL: "https://trielingual-default-rtdb.firebaseio.com",
    projectId: "trielingual",
    storageBucket: "trielingual.firebasestorage.app",
    messagingSenderId: "767053126731",
    appId: "1:767053126731:web:80c61791b403c944e281ce"
};

const firebaseApp = initializeApp(firebaseConfig);
const functions = getFunctions(firebaseApp);

let authenticatedUser = null;

async function callGenerateSentences(params) {
    try {
        // connectFunctionsEmulator(functions, "127.0.0.1", 5004);
        const fn = httpsCallable(functions, 'generateSentences');
        const result = await fn(params);
        return result?.data;
    } catch (err) {
        console.error('generateSentences error', err);
        throw err;
    }
}
async function callAnalyzeCollocation(params) {
    try {
        // connectFunctionsEmulator(functions, "127.0.0.1", 5004);
        const fn = httpsCallable(functions, 'analyzeCollocation');
        const result = await fn(params);
        return result?.data;
    } catch (err) {
        console.error('analyzeCollocation error', err);
        throw err;
    }
}

function initialize() {
    const auth = getAuth();
    const googleProvider = new GoogleAuthProvider();

    onAuthStateChanged(auth, (user) => {
        if (user) {
            authenticatedUser = user;
            signinButton.style.display = 'none';
            userAccountItem.style.display = 'block';
            welcomeMessage.textContent = user.email;
            // Hide login container if user just signed in
            if (loginContainer && loginContainer.style.display !== 'none') {
                loginContainer.style.display = 'none';
                mainContainer.removeAttribute('style');
            }
        } else {
            authenticatedUser = null;
            userAccountItem.style.display = 'none';
            signinButton.style.display = 'block';
            welcomeMessage.textContent = '';
        }
    });

    signoutButton.addEventListener('click', function () {
        const auth = getAuth();
        signOut(auth).then(() => {
            localStorage.clear();
            document.location.reload();
        }).catch((error) => {
            console.log(error);
        });
    });

    signinButton.addEventListener('click', function () {
        mainContainer.style.display = 'none';
        menuContainer.style.display = 'none';
        loginContainer.removeAttribute('style');
    });

    loginBackLink.addEventListener('click', function (e) {
        e.preventDefault();
        loginContainer.style.display = 'none';
        mainContainer.removeAttribute('style');
    });

    signinWithGoogle.addEventListener('click', function () {
        signInWithRedirect(auth, googleProvider);
    });
}

function getAuthenticatedUser() {
    return authenticatedUser;
}

export { initialize, getAuthenticatedUser, callAnalyzeCollocation, callGenerateSentences, firebaseApp }
