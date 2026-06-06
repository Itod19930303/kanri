const Auth = (() => {
  function isAvailable() {
    const c = window.KANRI_FIREBASE_CONFIG;
    return Boolean(c && c.apiKey && c.authDomain && window.firebase && typeof firebase.auth === 'function');
  }

  function ensureInit() {
    if (!firebase.apps.length && window.KANRI_FIREBASE_CONFIG) {
      firebase.initializeApp(window.KANRI_FIREBASE_CONFIG);
    }
  }

  function onAuthStateChanged(callback) {
    if (!isAvailable()) return;
    ensureInit();
    firebase.auth().onAuthStateChanged(callback);
  }

  async function signInWithGoogle() {
    ensureInit();
    const provider = new firebase.auth.GoogleAuthProvider();
    return firebase.auth().signInWithPopup(provider);
  }

  async function signInWithEmail(email, password) {
    ensureInit();
    return firebase.auth().signInWithEmailAndPassword(email, password);
  }

  async function signUpWithEmail(email, password) {
    ensureInit();
    return firebase.auth().createUserWithEmailAndPassword(email, password);
  }

  async function signOut() {
    return firebase.auth().signOut();
  }

  return { isAvailable, onAuthStateChanged, signInWithGoogle, signInWithEmail, signUpWithEmail, signOut };
})();
