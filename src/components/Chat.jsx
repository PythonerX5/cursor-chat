import React, { useState, useEffect, useRef } from 'react';
import { auth, db, sendMessage, createChat, clearChatMessages, updateUserStatus, searchUserByEmail } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, updateDoc, doc, getDocs, serverTimestamp, addDoc } from 'firebase/firestore';
import { signOut, updateProfile } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { FiLogOut, FiSearch, FiMoreVertical, FiSend, FiEdit, FiArrowLeft } from 'react-icons/fi';
import { RiChat3Line } from 'react-icons/ri';

// Username Input bileşeni
const UsernameInput = ({ value, onChange }) => {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 rounded-lg bg-[#2a3942] border border-gray-600 text-gray-200 placeholder-gray-400 focus:outline-none focus:border-gray-400"
      placeholder="Yeni kullanıcı adı"
      autoFocus
    />
  );
};

// Varsayılan avatarlar
const DEFAULT_AVATARS = {
  male: [
    'https://raw.githubusercontent.com/Ashwinvalento/cartoon-avatar/master/lib/images/male/45.png',
    'https://raw.githubusercontent.com/Ashwinvalento/cartoon-avatar/master/lib/images/male/86.png',
    'https://raw.githubusercontent.com/Ashwinvalento/cartoon-avatar/master/lib/images/male/5.png',
    'https://raw.githubusercontent.com/Ashwinvalento/cartoon-avatar/master/lib/images/male/15.png',
    'https://raw.githubusercontent.com/Ashwinvalento/cartoon-avatar/master/lib/images/male/25.png',
    'https://raw.githubusercontent.com/Ashwinvalento/cartoon-avatar/master/lib/images/male/35.png'
  ],
  female: [
    'https://raw.githubusercontent.com/Ashwinvalento/cartoon-avatar/master/lib/images/female/45.png',
    'https://raw.githubusercontent.com/Ashwinvalento/cartoon-avatar/master/lib/images/female/86.png',
    'https://raw.githubusercontent.com/Ashwinvalento/cartoon-avatar/master/lib/images/female/5.png',
    'https://raw.githubusercontent.com/Ashwinvalento/cartoon-avatar/master/lib/images/female/15.png',
    'https://raw.githubusercontent.com/Ashwinvalento/cartoon-avatar/master/lib/images/female/25.png',
    'https://raw.githubusercontent.com/Ashwinvalento/cartoon-avatar/master/lib/images/female/35.png'
  ]
};

const Chat = () => {
  const [users, setUsers] = useState([]);
  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showChatOptions, setShowChatOptions] = useState(false);
  const [isMobileView, setIsMobileView] = useState(window.innerWidth <= 768);
  const [showChatList, setShowChatList] = useState(true);
  const [newUsername, setNewUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [gender, setGender] = useState('male');
  const [selectedAvatar, setSelectedAvatar] = useState(auth.currentUser?.photoURL || '');
  const [customAvatar, setCustomAvatar] = useState(null);
  const messagesEndRef = useRef(null);
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [searchEmail, setSearchEmail] = useState('');
  const [searchError, setSearchError] = useState('');
  const [foundUser, setFoundUser] = useState(null);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const fileInputRef = useRef(null);

  // Ekran boyutunu izle
  useEffect(() => {
    const handleResize = () => {
      setIsMobileView(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Kullanıcıları getir ve arama sonuçlarını filtrele
  useEffect(() => {
    const q = query(collection(db, 'users'), where('uid', '!=', auth.currentUser.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const userList = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      setUsers(userList);
      
      // Arama sorgusu varsa filtreleme yap
      if (searchQuery.trim()) {
        const filtered = userList.filter(user => 
          user.displayName.toLowerCase().includes(searchQuery.toLowerCase())
        );
        setFilteredUsers(filtered);
      } else {
        setFilteredUsers(userList);
      }
    });
    return () => unsubscribe();
  }, [searchQuery]);

  // Sohbetleri getir
  useEffect(() => {
    const q = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', auth.currentUser.uid)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const chatList = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      setChats(chatList);
    });
    return () => unsubscribe();
  }, []);

  // Mesaj durumunu güncelle
  const updateMessageStatus = async (messageId, status) => {
    try {
      await updateDoc(doc(db, 'messages', messageId), { status });
    } catch (error) {
      console.error('Mesaj durumu güncellenirken hata:', error);
    }
  };

  // Mesajları getir ve durumlarını güncelle
  useEffect(() => {
    if (!selectedChat) return;

    // Mesajları getir
    const messagesQuery = query(
      collection(db, 'messages'),
      where('chatId', '==', selectedChat.id),
      orderBy('timestamp', 'asc')
    );

    // Mesajları dinle
    const unsubscribeMessages = onSnapshot(messagesQuery, (snapshot) => {
      const newMessages = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        const message = {
          id: doc.id,
          ...data,
          timestamp: data.timestamp?.toDate() || new Date()
        };

        // Karşı tarafın mesajlarını görüldü olarak işaretle
        if (message.senderId !== auth.currentUser.uid) {
          const otherUser = users.find(u => selectedChat.participants.includes(u.uid) && u.uid !== auth.currentUser.uid);
          if (otherUser?.status === 'online' && message.status !== 'seen') {
            updateMessageStatus(doc.id, 'seen');
          }
        }

        newMessages.push(message);
      });
      setMessages(newMessages);
      
      // Yeni mesaj geldiğinde scroll yap
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    });

    return () => {
      unsubscribeMessages();
    };
  }, [selectedChat, users]);

  // Profil modalı açıldığında kullanıcı adını yükle
  useEffect(() => {
    if (showProfileModal) {
      setNewUsername(auth.currentUser?.displayName || '');
      setSelectedAvatar(auth.currentUser?.photoURL || DEFAULT_AVATARS[gender][0]);
    }
  }, [showProfileModal, gender]);

  const handleUpdateProfile = async (selectedAvatar) => {
    try {
      setLoading(true);
      setError('');

      if (!newUsername.trim()) {
        setError('Kullanıcı adı boş olamaz');
        setLoading(false);
        return;
      }

      // Profili güncelle
      await Promise.all([
        updateProfile(auth.currentUser, {
          displayName: newUsername.trim(),
          photoURL: selectedAvatar
        }),
        // Firestore'daki kullanıcı bilgilerini güncelle
        updateDoc(doc(db, 'users', auth.currentUser.uid), {
          displayName: newUsername.trim(),
          photoURL: selectedAvatar,
          gender: gender
        })
      ]);

      setShowProfileModal(false);
    } catch (error) {
      console.error('Profil güncelleme hatası:', error);
      setError('Profil güncellenirken bir hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  // Mesaj gönderme fonksiyonu
  const handleSendMessage = async (e) => {
    e.preventDefault();
    const messageText = newMessage.trim();
    
    if (!messageText || !selectedChat) return;
    
    setNewMessage('');

    try {
      // Karşı kullanıcının durumunu kontrol et
      const otherUser = users.find(u => selectedChat.participants.includes(u.uid) && u.uid !== auth.currentUser.uid);
      const initialStatus = otherUser?.status === 'online' ? 'delivered' : 'sent';

      const messageData = {
        text: messageText,
        senderId: auth.currentUser.uid,
        senderName: auth.currentUser.displayName,
        senderAvatar: auth.currentUser.photoURL,
        chatId: selectedChat.id,
        timestamp: serverTimestamp(),
        status: initialStatus
      };

      // Mesajı Firestore'a ekle
      const docRef = await addDoc(collection(db, 'messages'), messageData);

      // Sohbetin son mesajını güncelle
      await updateDoc(doc(db, 'chats', selectedChat.id), {
        lastMessage: messageText,
        lastMessageTime: serverTimestamp()
      });

      // Scroll yap
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    } catch (error) {
      console.error('Mesaj gönderme hatası:', error);
      alert('Mesaj gönderilemedi. Lütfen tekrar deneyin.');
    }
  };

  const handleUserSelect = async (user) => {
    if (!user || !user.uid) {
      console.error('Geçersiz kullanıcı bilgisi');
      return;
    }

    try {
      // Mevcut sohbetleri kontrol et
      const existingChat = chats.find(chat => 
        chat.participants.includes(user.uid)
      );

      // Eğer seçili sohbet varsa ve aynı kullanıcıya tıklandıysa sohbeti kapat
      if (selectedChat && existingChat && selectedChat.id === existingChat.id && !isMobileView) {
        setSelectedChat(null);
        setMessages([]);
        return;
      }

      if (existingChat) {
        setSelectedChat(existingChat);
      } else {
        // Yeni sohbet oluştur
        const chatId = await createChat(user.uid);
        if (!chatId) {
          throw new Error('Sohbet oluşturulamadı');
        }

        const newChat = {
          id: chatId,
          participants: [auth.currentUser.uid, user.uid],
          createdAt: new Date(),
          lastMessage: null,
          lastMessageTime: null,
          lastRead: {
            [auth.currentUser.uid]: new Date(),
            [user.uid]: null
          }
        };

        setSelectedChat(newChat);
        setChats(prevChats => [...prevChats, newChat]);
      }

      // Mobil görünümde sohbet listesini gizle
      if (isMobileView) {
        setShowChatList(false);
      }

      // Arama sonuçlarını temizle
      setFoundUser(null);
      setSearchEmail('');
    } catch (error) {
      console.error('Sohbet seçme hatası:', error);
      alert('Sohbet başlatılırken bir hata oluştu. Lütfen tekrar deneyin.');
    }
  };

  const handleClearChat = async () => {
    if (!selectedChat) return;
    try {
      await clearChatMessages(selectedChat.id);
      setShowChatOptions(false);
    } catch (error) {
      console.error('Error clearing chat:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/');
    } catch (error) {
      console.error('Çıkış yapılırken hata:', error);
    }
  };

  // E-posta ile kullanıcı ara
  const handleSearchUser = async (e) => {
    e.preventDefault();
    setSearchError('');
    setFoundUser(null);

    if (!searchEmail.trim()) {
      setSearchError('Lütfen bir e-posta adresi girin');
      return;
    }

    try {
      const users = await searchUserByEmail(searchEmail.trim());
      
      if (users.length === 0) {
        setSearchError('Kullanıcı bulunamadı');
        return;
      }

      const user = users[0];
      
      // Kendimizi aramayı engelle
      if (user.uid === auth.currentUser.uid) {
        setSearchError('Kendinizle sohbet başlatamazsınız');
        return;
      }

      setFoundUser(user);
    } catch (error) {
      console.error('Kullanıcı arama hatası:', error);
      setSearchError('Kullanıcı aranırken bir hata oluştu');
    }
  };

  // Profil düzenleme modalı
  const ProfileModal = () => {
    const handleFileChange = (e) => {
      const file = e.target.files[0];
      if (file) {
        if (file.size > 5 * 1024 * 1024) { // 5MB limit
          alert('Dosya boyutu 5MB\'dan küçük olmalıdır.');
          return;
        }
        const reader = new FileReader();
        reader.onloadend = () => {
          setCustomAvatar(reader.result);
          setSelectedAvatar(reader.result);
        };
        reader.readAsDataURL(file);
      }
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-[#202c33] rounded-lg p-6 w-96 max-w-full">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-200">Profili Düzenle</h2>
            <button
              onClick={() => setShowProfileModal(false)}
              className="text-gray-400 hover:text-gray-200"
            >
              ✕
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-200 mb-2">
                Kullanıcı Adı
              </label>
              <UsernameInput 
                value={newUsername}
                onChange={setNewUsername}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-200 mb-2">
                Cinsiyet Seçin
              </label>
              <div className="flex space-x-4">
                <button
                  type="button"
                  onClick={() => setGender('male')}
                  className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                    gender === 'male'
                      ? 'bg-blue-500 text-white'
                      : 'bg-[#2a3942] text-gray-300 hover:bg-[#3c4c56]'
                  }`}
                >
                  Erkek
                </button>
                <button
                  type="button"
                  onClick={() => setGender('female')}
                  className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                    gender === 'female'
                      ? 'bg-pink-500 text-white'
                      : 'bg-[#2a3942] text-gray-300 hover:bg-[#3c4c56]'
                  }`}
                >
                  Kadın
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-200 mb-2">
                Avatar Seçin
              </label>
              <div className="grid grid-cols-3 gap-3">
                {DEFAULT_AVATARS[gender].map((avatar, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => {
                      setSelectedAvatar(avatar);
                      setCustomAvatar(null);
                    }}
                    className={`p-2 rounded-xl transition-all duration-200 transform hover:scale-105 ${
                      selectedAvatar === avatar && !customAvatar
                        ? 'bg-blue-100 ring-2 ring-blue-500 shadow-lg'
                        : 'bg-[#2a3942] hover:bg-[#3c4c56]'
                    }`}
                  >
                    <img
                      src={avatar}
                      alt={`Avatar ${index + 1}`}
                      className="w-full h-auto rounded-lg"
                    />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-200 mb-2">
                Kendi Fotoğrafınızı Yükleyin
              </label>
              <div className="flex flex-col items-center space-y-3">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*"
                  className="hidden"
                />
                {customAvatar && (
                  <div className="relative">
                    <img
                      src={customAvatar}
                      alt="Custom Avatar"
                      className="w-24 h-24 rounded-full object-cover"
                    />
                    <button
                      onClick={() => {
                        setCustomAvatar(null);
                        setSelectedAvatar(DEFAULT_AVATARS[gender][0]);
                      }}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                    >
                      ✕
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-[#2a3942] text-gray-300 rounded-lg hover:bg-[#3c4c56] transition-colors"
                >
                  {customAvatar ? 'Fotoğrafı Değiştir' : 'Fotoğraf Yükle'}
                </button>
                <p className="text-xs text-gray-400">
                  Maximum dosya boyutu: 5MB
                </p>
              </div>
            </div>

            {error && (
              <div className="text-red-500 text-sm text-center">{error}</div>
            )}

            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => setShowProfileModal(false)}
                className="flex-1 py-2 rounded-lg font-medium bg-[#2a3942] text-gray-300 hover:bg-[#3c4c56] transition-colors"
              >
                İptal
              </button>
              <button
                onClick={() => handleUpdateProfile(selectedAvatar)}
                disabled={loading}
                className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                  loading
                    ? 'bg-gray-500 cursor-not-allowed'
                    : 'bg-blue-500 hover:bg-blue-600 text-white'
                }`}
              >
                {loading ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // SearchModal bileşeni
  const SearchModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-[#202c33] rounded-lg p-6 w-96 max-w-full">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-200">Kullanıcı Ara</h2>
          <button
            onClick={() => {
              setShowSearchModal(false);
              setSearchEmail('');
              setSearchError('');
              setFoundUser(null);
            }}
            className="text-gray-400 hover:text-gray-200"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSearchUser} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm text-gray-300">
              Kullanıcı E-postası
            </label>
            <div className="flex space-x-2">
              <input
                type="email"
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                placeholder="ornek@email.com"
                className="flex-1 bg-[#2a3942] text-gray-200 rounded-lg px-4 py-2 focus:outline-none placeholder-gray-400"
                autoFocus
              />
              <button
                type="submit"
                className="bg-[#2a3942] text-gray-200 px-4 py-2 rounded-lg hover:bg-[#3c4c56] transition-colors"
              >
                Ara
              </button>
            </div>
          </div>
          {searchError && (
            <div className="text-red-500 text-sm">{searchError}</div>
          )}
        </form>

        {/* Bulunan Kullanıcı */}
        {foundUser && (
          <div className="mt-4 p-4 bg-[#2a3942] rounded-lg cursor-pointer hover:bg-[#3c4c56] transition-colors"
               onClick={() => {
                 handleUserSelect(foundUser);
                 setShowSearchModal(false);
                 setSearchEmail('');
                 setFoundUser(null);
               }}>
            <div className="flex items-center space-x-3">
              <img
                src={foundUser.photoURL || `https://ui-avatars.com/api/?name=${foundUser.displayName}&background=random`}
                alt={foundUser.displayName}
                className="w-12 h-12 rounded-full"
              />
              <div>
                <div className="text-gray-200 font-medium">{foundUser.displayName}</div>
                <div className="text-gray-400 text-sm">{foundUser.email}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // Sohbetten çıkma fonksiyonu
  const handleExitChat = () => {
    setSelectedChat(null);
    setMessages([]);
    setShowChatOptions(false);
    if (isMobileView) {
      setShowChatList(true);
    }
  };

  return (
    <div className="h-screen flex bg-[#111b21]">
      {/* Mobil görünümde seçili sohbet varsa sadece mesajlaşma alanını göster */}
      {(!isMobileView || showChatList) && (
        <div className={`${isMobileView ? 'w-full' : 'w-1/3'} border-r border-gray-700 flex flex-col`}>
          {/* Profil Başlığı */}
          <div className="bg-[#202c33] p-4 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <button 
                onClick={() => setShowProfileModal(true)}
                className="relative group"
              >
                <img
                  src={auth.currentUser?.photoURL || 'https://via.placeholder.com/40'}
                  alt="profile"
                  className="w-10 h-10 rounded-full"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                  <FiEdit className="text-white" />
                </div>
              </button>
              <span className="text-gray-200 font-medium">
                {auth.currentUser?.displayName || 'Kullanıcı'}
              </span>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setShowSearchModal(true)}
                className="text-gray-400 hover:text-gray-200"
              >
                <FiSearch size={24} />
              </button>
              <button
                onClick={handleLogout}
                className="text-gray-400 hover:text-gray-200"
              >
                <FiLogOut size={24} />
              </button>
            </div>
          </div>

          {/* Aktif Sohbetler */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-4 border-b border-gray-700">
              <h3 className="text-gray-400 text-sm font-medium">Aktif Sohbetler</h3>
            </div>
            {chats.map(chat => {
              const otherUser = users.find(u => chat.participants.includes(u.uid));
              if (!otherUser) return null;
              
              return (
                <div
                  key={chat.id}
                  onClick={() => handleUserSelect(otherUser)}
                  className="flex items-center space-x-3 p-4 hover:bg-[#202c33] cursor-pointer border-b border-gray-700"
                >
                  <img
                    src={otherUser.photoURL || `https://ui-avatars.com/api/?name=${otherUser.displayName}&background=random`}
                    alt={otherUser.displayName}
                    className="w-12 h-12 rounded-full"
                  />
                  <div>
                    <div className="text-gray-200 font-medium">{otherUser.displayName}</div>
                    <div className="text-gray-400 text-sm">
                      {otherUser.status === 'online' ? 'Çevrimiçi' : 'Çevrimdışı'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Mesajlaşma Alanı */}
      {(!isMobileView || !showChatList) && (
        <div className="flex-1 flex flex-col bg-[#0b141a]">
          {selectedChat ? (
            <>
              {/* Sohbet Başlığı */}
              <div className="bg-[#202c33] p-4 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {isMobileView && (
                    <button
                      onClick={() => setShowChatList(true)}
                      className="text-gray-400 hover:text-gray-200 mr-2"
                    >
                      <FiArrowLeft size={24} />
                    </button>
                  )}
                  <img
                    src={users.find(u => selectedChat.participants.includes(u.uid))?.photoURL || 'https://via.placeholder.com/40'}
                    alt="chat"
                    className="w-10 h-10 rounded-full"
                  />
                  <div>
                    <h3 className="text-gray-200 font-medium">
                      {users.find(u => selectedChat.participants.includes(u.uid))?.displayName}
                    </h3>
                    <p className="text-gray-400 text-sm">
                      {users.find(u => selectedChat.participants.includes(u.uid))?.status === 'online' ? 'Çevrimiçi' : 'Çevrimdışı'}
                    </p>
                  </div>
                </div>
                <div className="relative">
                  <button
                    onClick={() => setShowChatOptions(!showChatOptions)}
                    className="text-gray-400 hover:text-gray-200 p-2 rounded-full hover:bg-[#2a3942] transition-colors"
                  >
                    <FiMoreVertical size={24} />
                  </button>

                  {/* Sohbet Seçenekleri Dropdown */}
                  {showChatOptions && (
                    <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-[#2a3942] ring-1 ring-black ring-opacity-5 z-50">
                      <div className="py-1" role="menu">
                        <button
                          onClick={handleClearChat}
                          className="w-full text-left px-4 py-2 text-gray-200 hover:bg-[#3c4c56] transition-colors"
                        >
                          Sohbeti Temizle
                        </button>
                        <button
                          onClick={handleExitChat}
                          className="w-full text-left px-4 py-2 text-gray-200 hover:bg-[#3c4c56] transition-colors"
                        >
                          Sohbetten Çık
                        </button>
                        <button
                          disabled
                          className="w-full text-left px-4 py-2 text-gray-400 cursor-not-allowed"
                        >
                          Sohbeti Sil
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Mesaj Alanı */}
              <div 
                className="flex-1 overflow-y-auto p-4 space-y-4"
                style={{
                  backgroundImage: "url('https://i.pinimg.com/originals/97/c0/07/97c00759d90d786d9b6096d274ad3e07.png')",
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              >
                {messages.map(message => {
                  const isMyMessage = message.senderId === auth.currentUser.uid;
                  const messageTime = message.timestamp instanceof Date 
                    ? message.timestamp 
                    : message.timestamp?.toDate?.() 
                    || new Date();

                  return (
                    <div
                      key={message.id}
                      className={`flex ${isMyMessage ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`relative max-w-[70%] p-3 rounded-lg ${
                          isMyMessage
                            ? 'bg-[#005c4b] text-white rounded-tr-none'
                            : 'bg-[#202c33] text-white rounded-tl-none'
                        }`}
                      >
                        {message.text}
                        <div className="flex items-center justify-end space-x-1 mt-1">
                          <span className="text-[0.65rem] text-gray-400">
                            {messageTime.toLocaleTimeString('tr-TR', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                          {isMyMessage && (
                            <span className="text-[0.65rem] text-gray-400">
                              {message.status === 'seen' ? (
                                <svg viewBox="0 0 16 11" width="16" height="11" className="fill-blue-400">
                                  <path d="M11.071.653a.667.667 0 0 0-.952 0l-6.41 6.41-2.71-2.909a.667.667 0 0 0-.953.932l3.2 3.429a.667.667 0 0 0 .952 0l6.9-6.929a.667.667 0 0 0 0-.933z"></path>
                                  <path d="M15.071.653a.667.667 0 0 0-.952 0l-6.41 6.41-2.71-2.909a.667.667 0 0 0-.953.932l3.2 3.429a.667.667 0 0 0 .952 0l6.9-6.929a.667.667 0 0 0 0-.933z"></path>
                                </svg>
                              ) : message.status === 'delivered' ? (
                                <svg viewBox="0 0 16 11" width="16" height="11" className="fill-current">
                                  <path d="M11.071.653a.667.667 0 0 0-.952 0l-6.41 6.41-2.71-2.909a.667.667 0 0 0-.953.932l3.2 3.429a.667.667 0 0 0 .952 0l6.9-6.929a.667.667 0 0 0 0-.933z"></path>
                                  <path d="M15.071.653a.667.667 0 0 0-.952 0l-6.41 6.41-2.71-2.909a.667.667 0 0 0-.953.932l3.2 3.429a.667.667 0 0 0 .952 0l6.9-6.929a.667.667 0 0 0 0-.933z"></path>
                                </svg>
                              ) : (
                                <svg viewBox="0 0 16 11" width="16" height="11" className="fill-current">
                                  <path d="M11.071.653a.667.667 0 0 0-.952 0l-6.41 6.41-2.71-2.909a.667.667 0 0 0-.953.932l3.2 3.429a.667.667 0 0 0 .952 0l6.9-6.929a.667.667 0 0 0 0-.933z"></path>
                                </svg>
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Mesaj Gönderme */}
              <div className="bg-[#202c33] p-4">
                <form onSubmit={handleSendMessage} className="flex items-center space-x-4">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Mesaj yazın"
                    className="flex-1 bg-[#2a3942] text-gray-200 rounded-lg px-4 py-2 focus:outline-none placeholder-gray-400"
                  />
                  <button
                    type="submit"
                    disabled={!newMessage.trim()}
                    className="text-gray-400 hover:text-gray-200 disabled:opacity-50"
                  >
                    <FiSend size={24} />
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-[#222e35]">
              <div className="text-center text-gray-400">
                <RiChat3Line size={100} className="mx-auto mb-4 opacity-50" />
                <p className="text-xl">Sohbet başlatmak için bir kullanıcı seçin</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Profil düzenleme modalı */}
      {showProfileModal && <ProfileModal />}
      {showSearchModal && <SearchModal />}
    </div>
  );
};

export default Chat; 