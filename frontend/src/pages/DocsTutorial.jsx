import { BookOpen, Shield, Bot, Play, Settings2, Sparkles, MessageCircle, AlertCircle, ListOrdered } from 'lucide-react'

export default function DocsTutorial() {
    return (
        <div className="max-w-4xl mx-auto space-y-8 pb-12">
            <div>
                <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                    <BookOpen className="w-8 h-8 text-whatsapp-600" />
                    Tutorial Penggunaan
                </h1>
                <p className="text-gray-500 mt-2">
                    Panduan lengkap step-by-step menggunakan fitur unggulan WA Gateway: Anti-Block dan Auto-Reply & AI.
                </p>
            </div>

            {/* SEGMEN 1: ANTI BLOCK */}
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex items-center gap-3">
                    <Shield className="w-6 h-6 text-green-600" />
                    <h2 className="text-xl font-bold text-gray-900">Tutorial Fitur Anti-Block</h2>
                </div>
                <div className="p-6 space-y-6">
                    <p className="text-gray-600">
                        Fitur Anti-Block dirancang khusus agar nomor WhatsApp Anda terhindar dari pemblokiran (banned) saat mengirim pesan massal. Cara kerjanya adalah dengan menyimulasikan cara mengetik manusia dan mengatur batas pengiriman.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="border border-gray-100 bg-gray-50 p-4 rounded-xl">
                            <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                                <span className="bg-green-100 text-green-700 w-6 h-6 rounded-full flex items-center justify-center text-sm">1</span>
                                Jeda Antar Pesan (Delay)
                            </h3>
                            <p className="text-sm text-gray-600">
                                Berfungsi untuk memberi jeda acak (contoh: 1 - 5 detik) di antara setiap pengiriman pesan, membuat log pengiriman terlihat lebih natural.
                            </p>
                        </div>
                        <div className="border border-gray-100 bg-gray-50 p-4 rounded-xl">
                            <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                                <span className="bg-green-100 text-green-700 w-6 h-6 rounded-full flex items-center justify-center text-sm">2</span>
                                Batas Pengiriman (Rate Limit)
                            </h3>
                            <p className="text-sm text-gray-600">
                                Membatasi jumlah maksimal pesan yang boleh dikirim dalam hitungan Menit dan Jam (contoh: 50 pesan/jam) untuk menghindari spam tracking WhatsApp.
                            </p>
                        </div>
                        <div className="border border-gray-100 bg-gray-50 p-4 rounded-xl">
                            <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                                <span className="bg-green-100 text-green-700 w-6 h-6 rounded-full flex items-center justify-center text-sm">3</span>
                                Masa Pemanasan (Warmup)
                            </h3>
                            <p className="text-sm text-gray-600">
                                Untuk nomor WhatsApp baru, kecepatan pengiriman akan dibatasi secara ketat di hari ke-1, dan akan meningkat ke batas normal setelah masa warmup (misal 7 hari) selesai.
                            </p>
                        </div>
                        <div className="border border-gray-100 bg-gray-50 p-4 rounded-xl">
                            <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                                <span className="bg-green-100 text-green-700 w-6 h-6 rounded-full flex items-center justify-center text-sm">4</span>
                                Variasi Pesan (Spintax)
                            </h3>
                            <p className="text-sm text-gray-600">
                                Gunakan format <code className="bg-gray-200 px-1 rounded">{"{Halo|Hai|Selamat Pagi}"}</code> agar isi pesan Anda tidak selalu persis sama, yang merupakan indikasi utama bot spam.
                            </p>
                        </div>
                    </div>

                    <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-5">
                        <h4 className="font-bold text-gray-900 flex items-center gap-2 mb-3">
                            <Play className="w-5 h-5 text-blue-500" />
                            Langkah Mengaktifkan Anti-Block
                        </h4>
                        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
                            <li>Buka menu <strong>Anti-Block</strong> di sidebar sebelah kiri.</li>
                            <li>Pilih Session / Nomor WhatsApp yang ingin diatur dari dropdown di atas.</li>
                            <li>Klik tombol toggle menjadi <strong className="text-green-600">Aktif (Hijau)</strong> pada panel master <strong>Sistem Anti-Block</strong>.</li>
                            <li>Nyalakan toggle <strong>Jeda Antar Pesan</strong> dan atur Minimum dan Maximum Delay sesuai kebutuhan (Standar: 2 - 8 detik).</li>
                            <li>Nyalakan toggle <strong>Pembatasan Kecepatan (Rate Limit)</strong> dan isi batas per menit dan per jam pengiriman.</li>
                            <li>Klik tombol <strong>Simpan Pengaturan Utama</strong> di bagian bawah.</li>
                        </ol>
                    </div>
                </div>
            </div>

            {/* SEGMEN 2: AUTO REPLY & AI */}
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex items-center gap-3">
                    <Bot className="w-6 h-6 text-blue-600" />
                    <h2 className="text-xl font-bold text-gray-900">Tutorial Auto-Reply & AI Service</h2>
                </div>
                <div className="p-6 space-y-6">
                    <p className="text-gray-600">
                        Menu ini memungkinkan Anda membuat mesin pembalas pesan otomatis berdasarkan daftar keyword, atau bahkan menyambungkan chat pelanggan Anda ke sistem <strong>AI Assistant (Kimi)</strong> agar bot bisa menjawab pertanyaan dengan bahasa natural.
                    </p>

                    <div className="space-y-4">
                        <div className="border border-gray-200 rounded-xl overflow-hidden">
                            <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex items-center gap-2">
                                <Settings2 className="w-4 h-4 text-gray-500" />
                                <h3 className="font-semibold text-gray-800">1. Pengaturan Global</h3>
                            </div>
                            <div className="p-4 text-sm text-gray-600 space-y-3">
                                <p>Pastikan Anda <strong>Mengaktifkan Auto-Reply</strong> di panel sebelah kiri.</p>
                                <ul>
                                    <li className="flex gap-2">
                                        <div className="mt-1"><AlertCircle className="w-4 h-4 text-gray-400" /></div>
                                        <span><strong>Jeda Waktu (Cooldown):</strong> Waktu tunggu sebelum bot membalas pesan dari <em>orang yang sama</em> secara beruntun. Set ke 5 detik untuk menghindari balasan berulang.</span>
                                    </li>
                                    <li className="flex gap-2 mt-2">
                                        <div className="mt-1"><AlertCircle className="w-4 h-4 text-gray-400" /></div>
                                        <span><strong>Fallback / Tolak Nomor Asing:</strong> Jika dinyalakan, bot hanya akan merespons ini jika pesan berasal dari nomor yang <em>belum tersimpan di menu Contacts</em>. Berguna untuk memilah prospek baru.</span>
                                    </li>
                                </ul>
                            </div>
                        </div>

                        <div className="border border-gray-200 rounded-xl overflow-hidden">
                            <div className="bg-blue-50 px-4 py-2 border-b border-blue-100 flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-blue-500" />
                                <h3 className="font-semibold text-gray-800">2. Membuat Aturan dengan AI (Artificial Intelligence)</h3>
                            </div>
                            <div className="p-4 text-sm text-gray-600 space-y-4">
                                <p>Ingin bot yang pintar memahami chat? Anda bisa menggunakan fitur AI Assistant. Sistem AI ini akan dipanggil jika pelanggan mengetik "Tipe Trigger" yang Anda atur.</p>

                                <ol className="list-decimal list-inside space-y-2">
                                    <li>Pergi ke panel <strong>Daftar Keyword & Aturan</strong>, lalu klik <strong>Tambah Aturan</strong>.</li>
                                    <li>Isi <strong>Nama Aturan</strong> (misal: "Bot Tanya Jawab Produk").</li>
                                    <li>Pilih <strong>Tipe Trigger: Regex</strong>, dan ketik <strong>`.*`</strong> di kolom Kata Kunci. <em>(Ini artinya semua chat yang masuk akan diproses oleh aturan ini)</em>.</li>
                                    <li>Nyalakan toggle <strong>Gunakan AI Assistant (Kimi)</strong> menjadi warna Hijau.</li>
                                    <li>Di kolom <strong>Instruksi AI (System Prompt)</strong>, ketik instruksi yang tegas untuk bot Anda.</li>
                                </ol>

                                <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mt-3">
                                    <h4 className="text-gray-400 text-xs font-bold uppercase mb-2 flex gap-2 items-center"><MessageCircle className="w-3 h-3" /> Contoh System Prompt</h4>
                                    <p className="text-gray-200 font-mono text-xs leading-relaxed">
                                        "Anda adalah Budi, customer service dari toko Sepatu Keren. Tugas Anda hanya melayani pertanyaan seputar sepatu. Harga sepatu sneakers adalah Rp 250.000, sepatu pantofel Rp 300.000. Jawab dengan ramah, gunakan emoji, dan jangan gunakan karakter non-teks tebal. Jika Anda tidak tahu, katakan 'Mohon tunggu, admin manusia kami akan segera membalas'."
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="border border-gray-200 rounded-xl overflow-hidden">
                            <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex items-center gap-2">
                                <ListOrdered className="w-4 h-4 text-gray-500" />
                                <h3 className="font-semibold text-gray-800">3. Membuat Aturan Balasan Statis Klasik</h3>
                            </div>
                            <div className="p-4 text-sm text-gray-600 space-y-2">
                                <p>Jika Anda hanya ingin bot membalas persis sesuai format yang ditentukan (tanpa AI), cukup buat Aturan Baru, dan matikan fitur AI Assistant.</p>
                                <ul className="list-disc pl-5 space-y-1">
                                    <li><strong>Sama Persis (Exact):</strong> Chat harus persis sama misal "INFO" tidak akan membalas jika pelanggan mengetik "INFO KAK".</li>
                                    <li><strong>Mengandung Kata (Contains):</strong> Chat "INFO KAK" akan memicu balasan jika kata kuncinya "INFO".</li>
                                    <li><strong>Berawalan Kata:</strong> Membalas jika chat berawalan kata kunci (contoh: "!ping").</li>
                                </ul>
                                <p className="mt-3">Ketik isi balasan di kotak <strong>Pesan Balasan Statis</strong>, klik SIMPAN. Jangan lupa pastikan tombol statusnya aktif (Hijau di tabel).</p>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
            
            {/* Akhir Tutorial */}
            <div className="text-center text-sm text-gray-500 pt-8 pb-4">
                &copy; 2026 WA Gateway TPM. Need help? Contact the developer.
            </div>
        </div>
    )
}
