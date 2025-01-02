import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, updateDoc, deleteDoc, where, getDocs, setDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBO98QOh0xx_SBfy9MGcJMY-NT8K4KBPMc",
  authDomain: "cursor-chat-f543a.firebaseapp.com",
  projectId: "cursor-chat-f543a",
  storageBucket: "cursor-chat-f543a.firebasestorage.app",
  messagingSenderId: "438254006227",
  appId: "1:438254006227:web:c4e5d7b85ececbec38c926",
  measurementId: "G-KPCKGXPY54"
};

// Firebase'i başlat
const app = initializeApp(firebaseConfig);

// Auth ve Firestore servislerini al
export const auth = getAuth(app);
export const db = getFirestore(app);

// Koleksiyon referansları
export const usersRef = collection(db, "users");
export const messagesRef = collection(db, "messages");
export const chatsRef = collection(db, "chats");

// Yeni kullanıcı oluşturma fonksiyonu
export const createUserDocument = async (user, additionalData) => {
  if (!user) return;

  try {
    await setDoc(doc(db, 'users', user.uid), {
      uid: user.uid,
      email: user.email.toLowerCase(),
      displayName: user.displayName,
      photoURL: user.photoURL,
      ...additionalData,
      createdAt: serverTimestamp(),
      lastSeen: serverTimestamp()
    });
  } catch (error) {
    console.error("Error creating user document: ", error);
  }
};

// Kullanıcı arama fonksiyonu
export const searchUserByEmail = async (email) => {
  try {
    // E-postayı küçük harfe çevir
    const emailLower = email.toLowerCase();
    
    // Önce users koleksiyonunda ara
    const q = query(collection(db, 'users'), where('email', '==', emailLower));
    let querySnapshot = await getDocs(q);
    
    // Kullanıcı bulunamadıysa ve @ işareti varsa Firebase Auth'dan al
    if (querySnapshot.empty && email.includes('@')) {
      // Aranan e-posta ile eşleşen kullanıcıyı bul
      const usersQuery = query(collection(db, 'users'));
      const allUsers = await getDocs(usersQuery);
      const foundUser = allUsers.docs.find(doc => doc.data().email === emailLower);

      if (!foundUser) {
        return [];
      }

      return [{ id: foundUser.id, ...foundUser.data() }];
    }
    
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error searching user:', error);
    throw error;
  }
};

// Mesaj gönderme fonksiyonu
export const sendMessage = async (chatId, text) => {
  try {
    const batch = db.batch();

    // Yeni mesaj dokümanı oluştur
    const messageRef = doc(collection(db, 'messages'));
    const messageData = {
      chatId,
      text,
      senderId: auth.currentUser.uid,
      senderName: auth.currentUser.displayName,
      senderAvatar: auth.currentUser.photoURL,
      timestamp: serverTimestamp(),
      status: 'sent'
    };
    batch.set(messageRef, messageData);

    // Sohbetin son mesajını güncelle
    const chatRef = doc(db, 'chats', chatId);
    batch.update(chatRef, {
      lastMessage: text,
      lastMessageTime: serverTimestamp(),
      [`lastRead.${auth.currentUser.uid}`]: serverTimestamp()
    });

    // Batch işlemini gerçekleştir
    await batch.commit();
    return messageRef;
  } catch (error) {
    console.error("Mesaj gönderme hatası:", error);
    throw error;
  }
};

// Sohbet oluşturma fonksiyonu
export const createChat = async (participantId) => {
  if (!auth.currentUser || !participantId) {
    console.error('Geçersiz kullanıcı bilgileri');
    return null;
  }

  try {
    // Önce mevcut sohbeti kontrol et
    const q = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', auth.currentUser.uid)
    );
    const querySnapshot = await getDocs(q);
    const existingChat = querySnapshot.docs.find(
      doc => doc.data().participants.includes(participantId)
    );

    if (existingChat) {
      return existingChat.id;
    }

    // Yeni sohbet oluştur
    const chatData = {
      participants: [auth.currentUser.uid, participantId],
      createdAt: serverTimestamp(),
      lastMessage: null,
      lastMessageTime: null,
      lastRead: {
        [auth.currentUser.uid]: serverTimestamp(),
        [participantId]: null
      }
    };

    const chatRef = await addDoc(collection(db, 'chats'), chatData);
    return chatRef.id;
  } catch (error) {
    console.error("Sohbet oluşturma hatası:", error);
    return null;
  }
};

// Sohbet mesajlarını temizleme fonksiyonu
export const clearChatMessages = async (chatId) => {
  try {
    const messagesQuery = query(messagesRef, where("chatId", "==", chatId));
    const querySnapshot = await getDocs(messagesQuery);
    
    const deletePromises = querySnapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deletePromises);

    // Son mesaj bilgisini güncelle
    await updateDoc(doc(chatsRef, chatId), {
      lastMessage: null,
      lastMessageTime: null
    });
  } catch (error) {
    console.error("Error clearing chat messages: ", error);
    throw error;
  }
};

// Kullanıcı durumunu güncelleme fonksiyonu
export const updateUserStatus = async (status) => {
  if (!auth.currentUser) return;
  
  try {
    const userDoc = doc(usersRef, auth.currentUser.uid);
    await updateDoc(userDoc, {
      status,
      lastSeen: serverTimestamp()
    });
  } catch (error) {
    console.error("Error updating user status: ", error);
  }
};

// App'i default olarak export et
export default app;