const $ = id => document.getElementById(id);

const API_BASE = 'https://api.smartbooks.cecar.cloud/api';
const TOKEN_KEY = 'bibliocecar-token';
const USER_KEY = 'bibliocecar-user';

const roleNames = {
  admin: 'Administrador',
  bibliotecario: 'Vendedor / Operador',
  consulta: 'Consulta / Invitado'
};

const roleIds = {
  1: 'Administrador',
  2: 'Vendedor / Operador'
};

let currentUser = null;
let currentEmail = null;
let currentRole = 'bibliotecario';
let currentApiUser = null;
let editingLibroId = null;
let editingUsuarioId = null;
let editingClienteId = null;
let saleItems = [];

const state = {
  dashboard: null,
  libros: [],
  clientes: [],
  ventas: [],
  ingresos: [],
  lotes: [],
  inventario: [],
  usuarios: []
};

function pick(obj, ...keys){
  if(!obj) return undefined;
  for(const key of keys){
    if(Object.prototype.hasOwnProperty.call(obj,key)) return obj[key];
  }
  return undefined;
}

function money(n){
  return '$' + Number(n || 0).toLocaleString('es-CO');
}

function dateOnly(value){
  if(!value) return '';
  return String(value).slice(0,10);
}

function escapeHtml(value){
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&':'&amp;',
    '<':'&lt;',
    '>':'&gt;',
    '"':'&quot;',
    "'":'&#39;'
  }[char]));
}

function emailValid(email){
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function typeName(type){
  if(typeof type === 'string' && type.trim()) return type;
  const types = {1:"Student's Book",2:'Workbook'};
  return types[Number(type)] || 'Sin tipo';
}

function normalizeType(value){
  if(Number(value) === 2) return 2;
  const text = String(value || '').toLowerCase();
  if(text.includes('work')) return 2;
  return 1;
}

function stockBadge(n){
  if(Number(n) <= 0) return 'badge-red';
  if(Number(n) <= 5) return 'badge-gold';
  return 'badge-green';
}

function stockText(n){
  if(Number(n) <= 0) return 'Agotado';
  if(Number(n) <= 5) return 'Bajo stock';
  return 'Disponible';
}

function emptyRow(cols, message){
  return `<tr><td colspan="${cols}"><div class="empty-state">${message}</div></td></tr>`;
}

function canEdit(){
  return currentRole === 'admin' || currentRole === 'bibliotecario';
}

function mapApiRole(rol){
  if(Number(rol) === 1) return 'admin';
  if(Number(rol) === 2) return 'bibliotecario';

  const text = String(rol || '').toLowerCase();
  if(text.includes('admin')) return 'admin';
  if(text.includes('vendedor') || text.includes('bibliotecario') || text.includes('operador')) return 'bibliotecario';
  return 'consulta';
}

function getToken(){
  return sessionStorage.getItem(TOKEN_KEY);
}

function saveSession(token, usuario){
  sessionStorage.setItem(TOKEN_KEY, token);
  sessionStorage.setItem(USER_KEY, JSON.stringify(usuario));
}

function clearSession(){
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
}

function getApiError(payload, fallback){
  if(!payload) return fallback;
  return pick(payload,'mensaje','message','title','error') || fallback;
}

async function apiRequest(path, options = {}){
  const headers = {'Accept':'application/json', ...(options.headers || {})};
  const token = getToken();

  if(options.body !== undefined) headers['Content-Type'] = 'application/json';
  if(token && options.auth !== false) headers.Authorization = 'Bearer ' + token;

  const response = await fetch(API_BASE + path, {
    method: options.method || 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined
  });

  const text = await response.text();
  let payload = null;
  if(text){
    try{ payload = JSON.parse(text); }
    catch{ payload = text; }
  }

  if(!response.ok){
    if(response.status === 401 && options.auth !== false){
      doLogout(false);
      showToast('Sesion expirada o no autorizada. Inicia sesion nuevamente.');
    }
    throw new Error(typeof payload === 'string' ? payload : getApiError(payload, 'Error HTTP ' + response.status));
  }

  return payload;
}

function normalizeBook(item){
  const id = pick(item,'id','Id','libroId','LibroId');
  const tipoRaw = pick(item,'tipo','Tipo','tipoLibro','TipoLibro');
  return {
    id,
    nombre: pick(item,'nombre','Nombre','nombreLibro','NombreLibro') || '',
    nivel: pick(item,'nivel','Nivel','nivelLibro','NivelLibro') || '',
    tipo: normalizeType(tipoRaw),
    tipoTexto: typeof tipoRaw === 'string' ? tipoRaw : typeName(tipoRaw),
    edicion: pick(item,'edicion','Edicion','edicionLibro','EdicionLibro') || '',
    unidades: Number(pick(item,'stockTotal','StockTotal','stockDisponible','StockDisponible','unidades','Unidades') || 0),
    ingresadas: Number(pick(item,'cantidadIngresada','CantidadIngresada','ingresadas','Ingresadas') || pick(item,'stockTotal','StockTotal') || 0),
    compra: Number(pick(item,'valorCompra','ValorCompra','valorCompa','ValorCompa') || 0),
    venta: Number(pick(item,'valorVentaPublico','ValorVentaPublico','valorVentaPulico','ValorVentaPulico') || 0),
    lote: pick(item,'lote','Lote','codigoLote','CodigoLote') || ''
  };
}

function normalizeCliente(item){
  return {
    id: String(pick(item,'identificacion','Identificacion') || ''),
    nombre: pick(item,'nombres','Nombres','nombre','Nombre') || '',
    correo: pick(item,'email','Email','correo','Correo') || '',
    celular: pick(item,'celular','Celular') || '',
    nacimiento: dateOnly(pick(item,'fechaNacimiento','FechaNacimiento'))
  };
}

function normalizeVenta(item){
  return {
    id: pick(item,'id','Id'),
    comprobante: pick(item,'numeroComprobante','NumeroComprobante','numeroRecibo','NumeroRecibo') || '',
    recibo: pick(item,'numeroRecibo','NumeroRecibo') || '',
    cliente: pick(item,'clienteNombre','ClienteNombre','cliente','Cliente') || '',
    fecha: dateOnly(pick(item,'fecha','Fecha')),
    total: Number(pick(item,'total','Total') || 0),
    items: pick(item,'items','Items') || []
  };
}

function normalizeIngreso(item){
  return {
    id: pick(item,'id','Id'),
    fecha: dateOnly(pick(item,'fecha','Fecha')),
    libroId: pick(item,'libroId','LibroId'),
    libro: pick(item,'libro','Libro','libroNombre','LibroNombre') || '',
    lote: pick(item,'lote','Lote','codigoLote','CodigoLote') || '',
    unidades: Number(pick(item,'unidades','Unidades') || 0),
    compra: Number(pick(item,'valorCompra','ValorCompra') || 0),
    venta: Number(pick(item,'valorVentaPublico','ValorVentaPublico') || 0),
    nivel: pick(item,'nivel','Nivel') || '',
    tipo: pick(item,'tipo','Tipo') || ''
  };
}

function normalizeLote(item){
  if(typeof item === 'string') return {lote:item, actual:false};
  return {
    lote: pick(item,'codigo','Codigo','lote','Lote') || '',
    actual: Boolean(pick(item,'actual','Actual'))
  };
}

function normalizeUsuario(item){
  const rolRaw = pick(item,'rol','Rol');
  const rolText = String(rolRaw || '').toLowerCase();
  const rol = Number(rolRaw) || (rolText.includes('admin') ? 1 : 2);
  return {
    id: String(pick(item,'id','Id') || ''),
    identificacion: pick(item,'identificacion','Identificacion') || '',
    nombre: pick(item,'nombres','Nombres','nombre','Nombre') || '',
    correo: pick(item,'email','Email','correo','Correo') || '',
    rol,
    estado: Boolean(pick(item,'activo','Activo'))
  };
}

async function doLogin(event){
  const btn = $('loginBtn');
  const email = $('loginEmail').value.trim();
  const pass = $('loginPass').value;
  let ok = true;

  $('emailErr').style.display = 'none';
  $('passErr').style.display = 'none';

  if(!email || !emailValid(email)){
    $('emailErr').style.display = 'block';
    ok = false;
  }

  if(!pass || pass.length < 4){
    $('passErr').style.display = 'block';
    ok = false;
  }

  if(!ok) return;

  try{
    rippleBtn(btn,event);
    btn.innerHTML = '<span class="spinner"></span> Ingresando...';
    btn.disabled = true;

    const data = await apiRequest('/Seguridad/iniciar-sesion', {
      method:'POST',
      auth:false,
      body:{email,password:pass}
    });

    const token = pick(data,'token','Token');
    const usuario = pick(data,'usuario','Usuario') || {};

    if(!token) throw new Error('La API no devolvio token de sesion.');

    saveSession(token, usuario);
    setCurrentUser(usuario, email);
    await initApp();
  }catch(error){
    showToast(error.message || 'No se pudo iniciar sesion.');
    btn.innerHTML = 'Ingresar al sistema';
    btn.disabled = false;
  }
}

function setCurrentUser(usuario, fallbackEmail){
  currentApiUser = usuario || {};
  currentEmail = pick(usuario,'email','Email') || fallbackEmail || '';
  currentUser = pick(usuario,'nombres','Nombres','nombre','Nombre') || (currentEmail ? currentEmail.split('@')[0] : 'Usuario');
  currentRole = mapApiRole(pick(usuario,'rol','Rol'));
}

async function initApp(){
  $('loginPage').style.display = 'none';
  $('appShell').style.display = 'flex';

  updateUserChrome();
  applyRoleVisibility();
  applyEditorVisibility();
  goHome();
  await loadInitialData();
  showToast('Bienvenido, ' + currentUser);
}

function updateUserChrome(){
  const initial = (currentUser || 'U')[0].toUpperCase();
  $('userNameDisplay').textContent = currentUser;
  $('userRoleDisplay').textContent = roleNames[currentRole] || 'Usuario';
  $('userAvatar').textContent = initial;

  $('profileUser').value = currentUser;
  $('profileEmail').value = currentEmail;
  $('profileRoleInput').value = roleNames[currentRole] || 'Usuario';
  $('profileName').textContent = currentUser;
  $('profileRole').textContent = roleNames[currentRole] || 'Usuario';
  $('profileAvatar').textContent = initial;
}

async function restoreSession(){
  const token = getToken();
  const savedUser = sessionStorage.getItem(USER_KEY);
  if(!token || !savedUser) return;

  try{
    setCurrentUser(JSON.parse(savedUser));
    await initApp();
  }catch{
    clearSession();
  }
}

function doLogout(showMessage = true){
  clearSession();
  $('appShell').style.display = 'none';
  $('loginPage').style.display = 'flex';
  $('loginBtn').innerHTML = 'Ingresar al sistema';
  $('loginBtn').disabled = false;
  $('loginEmail').value = '';
  $('loginPass').value = '';
  currentUser = null;
  currentEmail = null;
  currentApiUser = null;
  if(showMessage) showToast('Sesion cerrada.');
}

function goHome(){
  if(currentRole === 'consulta') showPage('libros');
  else showPage('dashboard');
}

function applyRoleVisibility(){
  document.querySelectorAll('.role-admin,.role-bibliotecario,.role-consulta').forEach(el => {
    const visible =
      (currentRole === 'admin' && el.classList.contains('role-admin')) ||
      (currentRole === 'bibliotecario' && el.classList.contains('role-bibliotecario')) ||
      (currentRole === 'consulta' && el.classList.contains('role-consulta'));
    el.classList.toggle('hidden', !visible);
  });
}

function applyEditorVisibility(){
  document.querySelectorAll('.editor-only').forEach(el => {
    el.classList.toggle('hidden', !canEdit());
  });
}

function showPage(id){
  const page = $('page-' + id);
  if(!page || page.classList.contains('hidden')) return;

  document.querySelectorAll('.content-page').forEach(item => item.classList.remove('active'));
  document.querySelectorAll('.sidebar-link').forEach(item => item.classList.remove('active'));

  page.classList.add('active');
  const nav = $('nav-' + id);
  if(nav) nav.classList.add('active');
}

async function loadInitialData(){
  const tasks = [
    loadDashboard(),
    loadLibros(),
    loadClientes(),
    loadVentas(),
    loadIngresos(),
    loadLotes(),
    loadInventario(),
    loadPerfil()
  ];

  if(currentRole === 'admin') tasks.push(loadUsuarios());

  const results = await Promise.allSettled(tasks);
  const failed = results.filter(item => item.status === 'rejected');
  renderAll();

  if(failed.length){
    console.warn('Algunas consultas de API fallaron:', failed);
    showToast('Algunos datos no pudieron cargarse. Revisa credenciales o permisos.');
  }
}

async function loadDashboard(){
  if(currentRole === 'consulta') return;
  state.dashboard = await apiRequest('/Dashboard');
}

async function loadLibros(){
  try{
    const stock = await apiRequest('/Libros/stock');
    state.libros = Array.isArray(stock) ? stock.map(normalizeBook) : [];
  }catch{
    const libros = await apiRequest('/Libros');
    state.libros = Array.isArray(libros) ? libros.map(normalizeBook) : [];
  }
}

async function loadClientes(){
  if(currentRole === 'consulta') return;
  const data = await apiRequest('/Clientes');
  state.clientes = Array.isArray(data) ? data.map(normalizeCliente) : [];
}

async function loadVentas(){
  if(currentRole === 'consulta') return;
  const data = await apiRequest('/Ventas');
  state.ventas = Array.isArray(data) ? data.map(normalizeVenta) : [];
}

async function loadIngresos(){
  if(currentRole === 'consulta') return;
  const data = await apiRequest('/Ingresos');
  state.ingresos = Array.isArray(data) ? data.map(normalizeIngreso) : [];
}

async function loadLotes(){
  if(currentRole === 'consulta') return;
  const data = await apiRequest('/Lotes');
  state.lotes = Array.isArray(data) ? data.map(normalizeLote).filter(item => item.lote) : [];
}

async function loadInventario(){
  const data = await apiRequest('/Inventarios');
  state.inventario = Array.isArray(data) ? data.map(normalizeBook) : [];
}

async function loadUsuarios(){
  const data = await apiRequest('/Usuarios');
  state.usuarios = Array.isArray(data) ? data.map(normalizeUsuario) : [];
}

async function loadPerfil(){
  const perfil = await apiRequest('/Usuarios/perfil');
  if(perfil){
    const usuario = {
      id: pick(perfil,'id','Id'),
      nombres: pick(perfil,'nombres','Nombres') || currentUser,
      email: pick(perfil,'email','Email') || currentEmail,
      rol: pick(perfil,'rol','Rol') || pick(currentApiUser,'rol','Rol')
    };
    setCurrentUser(usuario, currentEmail);
    saveSession(getToken(), usuario);
    updateUserChrome();
    applyRoleVisibility();
    applyEditorVisibility();
  }
}

function renderAll(){
  renderStats();
  renderDashboardCards();
  renderLibros();
  renderClientes();
  renderVentas();
  renderInventario();
  renderIngresos();
  renderLotes();
  renderUsuarios();
  renderSalePreview();
}

function renderStats(){
  const dash = state.dashboard || {};
  const totalLibros = pick(dash,'totalLibros','TotalLibros') ?? state.libros.length;
  const totalClientes = pick(dash,'totalClientes','TotalClientes') ?? state.clientes.length;
  const cantVentasMes = pick(dash,'cantVentasMes','CantVentasMes') ?? state.ventas.length;
  const totalStock = state.libros.reduce((acc,item) => acc + Number(item.unidades || 0),0);

  $('statLibros').textContent = totalLibros;
  $('statStock').textContent = totalStock;
  $('statClientes').textContent = totalClientes;
  $('statVentas').textContent = cantVentasMes;
}

function renderDashboardCards(){
  if(!$('modulesGrid')) return;

  const dash = state.dashboard || {};
  const totalLibros = pick(dash,'totalLibros','TotalLibros') ?? state.libros.length;
  const totalClientes = pick(dash,'totalClientes','TotalClientes') ?? state.clientes.length;
  const cantVentasMes = pick(dash,'cantVentasMes','CantVentasMes') ?? state.ventas.length;
  const totalStock = state.libros.reduce((acc,item) => acc + Number(item.unidades || 0),0);

  $('dashLibrosMini').textContent = totalLibros;
  $('dashStockMini').textContent = totalStock;
  $('dashVentasMini').textContent = cantVentasMes;
  $('dashLotesMini').textContent = state.lotes.length;

  $('modulesGrid').innerHTML = `
    <div class="dashboard-module" onclick="showPage('libros')"><div class="dashboard-module-top"><div class="icon">LB</div><strong>Libros</strong></div><p>Registra titulos, tipo, edicion, nivel, precios, lote y unidades.</p><span>${state.libros.length} registros cargados</span></div>
    <div class="dashboard-module" onclick="showPage('clientes')"><div class="dashboard-module-top"><div class="icon">CL</div><strong>Clientes</strong></div><p>Administra compradores con identificacion, correo y contacto.</p><span>${totalClientes} clientes</span></div>
    <div class="dashboard-module" onclick="showPage('ventas')"><div class="dashboard-module-top"><div class="icon">VT</div><strong>Ventas</strong></div><p>Registra comprobantes, agrega libros y descuenta inventario.</p><span>${cantVentasMes} ventas del mes</span></div>
    <div class="dashboard-module" onclick="showPage('inventario')"><div class="dashboard-module-top"><div class="icon">IN</div><strong>Inventario</strong></div><p>Consulta existencias por libro, lote, stock y estado.</p><span>${totalStock} unidades</span></div>
    <div class="dashboard-module" onclick="showPage('ingresos')"><div class="dashboard-module-top"><div class="icon">IG</div><strong>Ingresos</strong></div><p>Registra entradas para aumentar existencias y actualizar precios.</p><span>${state.ingresos.length} ingresos</span></div>
    <div class="dashboard-module" onclick="showPage('lotes')"><div class="dashboard-module-top"><div class="icon">LT</div><strong>Lotes</strong></div><p>Crea identificadores para organizar libros e inventario.</p><span>${state.lotes.length} lotes</span></div>
    <div class="dashboard-module role-admin" onclick="showPage('usuarios')"><div class="dashboard-module-top"><div class="icon">US</div><strong>Usuarios</strong></div><p>Administra cuentas, roles y estados de acceso.</p><span>${state.usuarios.length} usuarios</span></div>
  `;

  const lowStock = state.libros.filter(item => Number(item.unidades) <= 5).slice(0,4);
  $('dashLowStock').innerHTML = lowStock.length ? lowStock.map(item => `
    <div class="stock-item"><div><strong>${escapeHtml(item.nombre)}</strong><small>ID ${item.id || '-'} - ${escapeHtml(item.lote || 'Sin lote')}</small></div><span class="badge ${stockBadge(item.unidades)}">${stockText(item.unidades)}</span></div>
  `).join('') : '<div class="empty-state">No hay libros con bajo stock.</div>';

  const ventasHoy = pick(dash,'ventasHoy','VentasHoy');
  const recentVentas = Array.isArray(ventasHoy) ? ventasHoy.slice(0,2).map(item => ({
    title:'Venta ' + (pick(item,'numeroRecibo','NumeroRecibo') || 'reciente'),
    detail:money(pick(item,'total','Total')) + ' - ' + dateOnly(pick(item,'fecha','Fecha')),
    badge:'Venta'
  })) : state.ventas.slice(-2).reverse().map(item => ({title:'Venta ' + item.comprobante,detail:item.cliente + ' - ' + money(item.total),badge:'Venta'}));

  const recentIngresos = state.ingresos.slice(-2).reverse().map(item => ({
    title:'Ingreso ' + (item.libro || item.lote),
    detail:item.unidades + ' unidades - ' + item.lote,
    badge:'Ingreso'
  }));

  const recent = [...recentVentas,...recentIngresos].slice(0,4);
  $('dashRecentActivity').innerHTML = recent.length ? recent.map(item => `
    <div class="activity-item"><div><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.detail)}</small></div><span class="badge badge-blue">${item.badge}</span></div>
  `).join('') : '<div class="empty-state">Aun no hay actividad registrada.</div>';

  applyRoleVisibility();
}

function renderLibros(){
  const tbody = document.querySelector('#tblLibros tbody');
  tbody.innerHTML = state.libros.length ? state.libros.map(item => `
    <tr>
      <td>${item.id || '-'}</td><td>${escapeHtml(item.nombre)}</td><td>${escapeHtml(item.nivel)}</td><td>${escapeHtml(typeName(item.tipoTexto || item.tipo))}</td><td>${escapeHtml(item.edicion)}</td>
      <td><span class="badge ${stockBadge(item.unidades)}">${item.unidades}</span></td><td>${money(item.venta)}</td><td>${escapeHtml(item.lote)}</td>
      <td><button class="btn btn-secondary btn-sm" onclick="showLibro(${Number(item.id)},event)">Ver</button>${canEdit() ? ` <button class="btn btn-secondary btn-sm" onclick="editLibro(${Number(item.id)},event)">Editar</button>` : ''}</td>
    </tr>
  `).join('') : emptyRow(9,'No hay libros registrados.');
}

async function saveLibro(event){
  rippleBtn(event.currentTarget,event);
  const nombre = $('libroNombre').value.trim();
  const nivel = $('libroNivel').value.trim();
  const tipo = Number($('libroTipo').value);
  const edicion = $('libroEdicion').value.trim();
  const unidades = Number($('libroUnidades').value || 0);
  const lote = $('libroLote').value.trim();
  const valorCompra = Number($('libroCompra').value || 0);
  const valorVentaPublico = Number($('libroVenta').value || 0);

  if(!nombre || !nivel || !tipo || !edicion) return showToast('Completa nombre, nivel, tipo y edicion.');

  try{
    if(editingLibroId){
      await apiRequest('/Libros/' + editingLibroId, {method:'PUT', body:{nombre,nivel,tipo,edicion}});
      showToast('Libro actualizado. Stock y precios se ajustan desde Ingresos.');
    }else{
      if(!lote) return showToast('El lote es obligatorio para registrar un libro.');
      await apiRequest('/Libros', {method:'POST', body:{nombre,nivel,tipo,edicion,unidades,lote,valorCompra,valorVentaPublico}});
      showToast('Libro registrado correctamente.');
    }
    clearLibroForm();
    await loadLibros();
    await loadInventario().catch(() => {});
    await loadDashboard().catch(() => {});
    renderAll();
  }catch(error){ showToast(error.message); }
}

function editLibro(id,event){
  rippleBtn(event.currentTarget,event);
  const item = state.libros.find(book => Number(book.id) === Number(id));
  if(!item) return;
  $('libroNombre').value = item.nombre;
  $('libroNivel').value = item.nivel;
  $('libroTipo').value = item.tipo;
  $('libroEdicion').value = item.edicion;
  $('libroUnidades').value = item.unidades;
  $('libroLote').value = item.lote;
  $('libroCompra').value = item.compra;
  $('libroVenta').value = item.venta;
  $('libroFormTitle').textContent = 'Editando libro ID ' + id;
  editingLibroId = Number(id);
  showToast('Libro listo para editar.');
}

function clearLibroForm(event){
  if(event) rippleBtn(event.currentTarget,event);
  ['libroNombre','libroNivel','libroTipo','libroEdicion','libroUnidades','libroLote','libroCompra','libroVenta'].forEach(id => $(id).value = '');
  $('libroFormTitle').textContent = 'Registrar / Actualizar Libro';
  editingLibroId = null;
}

async function showLibro(id,event){
  rippleBtn(event.currentTarget,event);
  try{
    const apiItem = await apiRequest('/Libros/' + id);
    const item = normalizeBook(apiItem);
    $('modalTitle').textContent = 'Detalle del libro';
    $('modalBody').innerHTML = `<p><strong>ID:</strong> ${item.id}</p><p><strong>Nombre:</strong> ${escapeHtml(item.nombre)}</p><p><strong>Nivel:</strong> ${escapeHtml(item.nivel)}</p><p><strong>Tipo:</strong> ${escapeHtml(typeName(item.tipoTexto || item.tipo))}</p><p><strong>Edicion:</strong> ${escapeHtml(item.edicion)}</p>`;
    openModal('modalInfo');
  }catch(error){ showToast(error.message); }
}

function renderClientes(){
  const tbody = document.querySelector('#tblClientes tbody');
  tbody.innerHTML = state.clientes.length ? state.clientes.map(item => `
    <tr><td>${escapeHtml(item.id)}</td><td>${escapeHtml(item.nombre)}</td><td>${escapeHtml(item.correo)}</td><td>${escapeHtml(item.celular)}</td><td><button class="btn btn-secondary btn-sm" onclick="showCliente('${escapeHtml(item.id)}',event)">Ver</button> <button class="btn btn-secondary btn-sm" onclick="editCliente('${escapeHtml(item.id)}',event)">Editar</button></td></tr>
  `).join('') : emptyRow(5,'No hay clientes registrados.');
}

async function saveCliente(event){
  rippleBtn(event.currentTarget,event);
  const identificacion = $('clienteId').value.trim();
  const nombres = $('clienteNombre').value.trim();
  const email = $('clienteCorreo').value.trim();
  const celular = $('clienteCelular').value.trim();
  const fechaNacimiento = $('clienteNacimiento').value;
  if(!identificacion || !nombres || !email || !celular || !fechaNacimiento) return showToast('Completa todos los datos del cliente.');
  if(!emailValid(email)) return showToast('El correo del cliente no es valido.');
  try{
    if(editingClienteId){
      await apiRequest('/Clientes/' + encodeURIComponent(editingClienteId), {method:'PUT', body:{nombres,email,celular,fechaNacimiento}});
      showToast('Cliente actualizado correctamente.');
    }else{
      await apiRequest('/Clientes', {method:'POST', body:{identificacion,nombres,email,celular,fechaNacimiento}});
      showToast('Cliente guardado correctamente.');
    }
    clearClienteForm();
    await loadClientes();
    await loadDashboard().catch(() => {});
    renderAll();
  }catch(error){ showToast(error.message); }
}

function editCliente(id,event){
  rippleBtn(event.currentTarget,event);
  const item = state.clientes.find(cliente => cliente.id === id);
  if(!item) return;
  $('clienteId').value = item.id;
  $('clienteId').disabled = true;
  $('clienteNombre').value = item.nombre;
  $('clienteCorreo').value = item.correo;
  $('clienteCelular').value = item.celular;
  $('clienteNacimiento').value = item.nacimiento;
  editingClienteId = id;
  showToast('Cliente listo para editar.');
}

function clearClienteForm(event){
  if(event) rippleBtn(event.currentTarget,event);
  ['clienteId','clienteNombre','clienteCorreo','clienteCelular','clienteNacimiento'].forEach(id => $(id).value = '');
  $('clienteId').disabled = false;
  editingClienteId = null;
}

async function showCliente(id,event){
  rippleBtn(event.currentTarget,event);
  try{
    const item = normalizeCliente(await apiRequest('/Clientes/' + encodeURIComponent(id)));
    $('modalTitle').textContent = 'Detalle del cliente';
    $('modalBody').innerHTML = `<p><strong>Identificacion:</strong> ${escapeHtml(item.id)}</p><p><strong>Nombre:</strong> ${escapeHtml(item.nombre)}</p><p><strong>Correo:</strong> ${escapeHtml(item.correo)}</p><p><strong>Celular:</strong> ${escapeHtml(item.celular)}</p><p><strong>Fecha de nacimiento:</strong> ${escapeHtml(item.nacimiento)}</p>`;
    openModal('modalInfo');
  }catch(error){ showToast(error.message); }
}

function addSaleItem(event){
  rippleBtn(event.currentTarget,event);
  const libro = state.libros.find(item => Number(item.id) === Number($('ventaLibroId').value));
  const lote = $('ventaLote').value.trim();
  const cantidad = Number($('ventaCantidad').value || 1);
  if(!libro) return showToast('No existe un libro con ese ID.');
  if(!lote) return showToast('Escribe el lote del libro.');
  if(libro.lote && libro.lote !== lote) return showToast('El lote no coincide con el libro seleccionado.');
  if(cantidad <= 0 || Number.isNaN(cantidad)) return showToast('La cantidad debe ser mayor a cero.');
  if(Number(libro.unidades) < cantidad) return showToast('Stock insuficiente para este libro.');
  saleItems.push({libroId:Number(libro.id),libro:libro.nombre,lote,cantidad,total:Number(libro.venta || 0) * cantidad});
  $('ventaLibroId').value = '';
  $('ventaLote').value = '';
  $('ventaCantidad').value = '';
  renderSalePreview();
}

function renderSalePreview(){
  const box = $('saleItemsPreview');
  if(!box) return;
  const total = saleItems.reduce((acc,item) => acc + item.total,0);
  box.innerHTML = saleItems.length ? `${saleItems.map((item,index) => `<div class="sale-item-chip"><span>${escapeHtml(item.libro)} - ${escapeHtml(item.lote)} - x${item.cantidad} - ${money(item.total)}</span><button class="btn btn-danger btn-sm" onclick="removeSaleItem(${index},event)">Quitar</button></div>`).join('')}<div class="sale-total">Total estimado: ${money(total)}</div>` : '<span style="font-size:12px;color:var(--muted)">Sin items agregados</span>';
}

function removeSaleItem(index,event){
  rippleBtn(event.currentTarget,event);
  saleItems.splice(index,1);
  renderSalePreview();
}

async function saveVenta(event){
  rippleBtn(event.currentTarget,event);
  const identificacionCliente = $('ventaCliente').value.trim();
  const numeroComprobante = $('ventaComprobante').value.trim();
  const observaciones = $('ventaObs').value.trim();
  if(!identificacionCliente || !numeroComprobante) return showToast('Cliente y comprobante son obligatorios.');
  if(!saleItems.length) return showToast('Agrega al menos un item.');
  try{
    await apiRequest('/Ventas', {method:'POST', body:{identificacionCliente,numeroComprobante,observaciones,items:saleItems.map(item => ({libroId:item.libroId,lote:item.lote,cantidad:item.cantidad}))}});
    saleItems = [];
    ['ventaCliente','ventaComprobante','ventaObs','ventaLibroId','ventaLote','ventaCantidad'].forEach(id => $(id).value = '');
    await Promise.allSettled([loadVentas(),loadLibros(),loadInventario(),loadDashboard()]);
    renderAll();
    showToast('Venta registrada correctamente.');
  }catch(error){ showToast(error.message); }
}

function renderVentas(list = state.ventas){
  const tbody = document.querySelector('#tblVentas tbody');
  tbody.innerHTML = list.length ? list.map(item => `
    <tr><td>${escapeHtml(item.comprobante || item.recibo)}</td><td>${escapeHtml(item.cliente)}</td><td>${escapeHtml(item.fecha)}</td><td>${item.items.length || '-'}</td><td>${money(item.total)}</td><td><button class="btn btn-secondary btn-sm" onclick="showVenta(${Number(item.id)},event)">Ver</button></td></tr>
  `).join('') : emptyRow(6,'No hay ventas registradas.');
}

async function showVenta(id,event){
  rippleBtn(event.currentTarget,event);
  try{
    const item = normalizeVenta(await apiRequest('/Ventas/' + id));
    $('modalTitle').textContent = 'Detalle de venta';
    $('modalBody').innerHTML = `<p><strong>Recibo:</strong> ${escapeHtml(item.recibo || item.comprobante)}</p><p><strong>Comprobante:</strong> ${escapeHtml(item.comprobante)}</p><p><strong>Cliente:</strong> ${escapeHtml(item.cliente)}</p><p><strong>Fecha:</strong> ${escapeHtml(item.fecha)}</p><p><strong>Total:</strong> ${money(item.total)}</p>`;
    openModal('modalInfo');
  }catch(error){ showToast(error.message); }
}

function filterVentas(){
  const q = $('ventasSearch').value.toLowerCase();
  const desde = $('ventasDesde').value;
  const hasta = $('ventasHasta').value;
  const list = state.ventas.filter(item => {
    const text = (item.comprobante + ' ' + item.recibo + ' ' + item.cliente).toLowerCase();
    return text.includes(q) && (!desde || item.fecha >= desde) && (!hasta || item.fecha <= hasta);
  });
  renderVentas(list);
}

function renderInventario(){
  const tbody = document.querySelector('#tblInventario tbody');
  const data = state.inventario.length ? state.inventario : state.libros;
  tbody.innerHTML = data.length ? data.map(item => `
    <tr><td>${item.id || '-'}</td><td>${escapeHtml(item.lote)}</td><td>${escapeHtml(item.nombre)}</td><td>${item.ingresadas || 0}</td><td><span class="badge ${stockBadge(item.unidades)}">${item.unidades}</span></td><td><span class="badge ${stockBadge(item.unidades)}">${stockText(item.unidades)}</span></td></tr>
  `).join('') : emptyRow(6,'No hay inventario disponible.');
}

async function refreshInventario(event){
  rippleBtn(event.currentTarget,event);
  try{
    await loadInventario();
    renderInventario();
    showToast('Inventario actualizado.');
  }catch(error){ showToast(error.message); }
}

async function saveIngreso(event){
  rippleBtn(event.currentTarget,event);
  const libroId = Number($('ingresoLibroId').value);
  const unidades = Number($('ingresoUnidades').value || 0);
  const lote = $('ingresoLote').value.trim();
  const valorCompra = Number($('ingresoCompra').value || 0);
  const valorVentaPublico = Number($('ingresoVenta').value || 0);
  if(!libroId || unidades <= 0 || !lote) return showToast('Libro, unidades y lote son obligatorios.');
  try{
    await apiRequest('/Ingresos', {method:'POST', body:{libroId,unidades,lote,valorCompra,valorVentaPublico}});
    ['ingresoLibroId','ingresoUnidades','ingresoLote','ingresoCompra','ingresoVenta'].forEach(id => $(id).value = '');
    await Promise.allSettled([loadIngresos(),loadLibros(),loadInventario(),loadLotes(),loadDashboard()]);
    renderAll();
    showToast('Ingreso registrado correctamente.');
  }catch(error){ showToast(error.message); }
}

function renderIngresos(list = state.ingresos){
  const tbody = document.querySelector('#tblIngresos tbody');
  tbody.innerHTML = list.length ? list.map(item => `
    <tr><td>${escapeHtml(item.fecha)}</td><td>${escapeHtml(item.libro)}</td><td>${escapeHtml(item.lote)}</td><td>${item.unidades}</td><td>${money(item.compra)}</td><td>${money(item.venta)}</td><td><button class="btn btn-secondary btn-sm" onclick="showIngreso(${Number(item.id)},event)">Ver</button></td></tr>
  `).join('') : emptyRow(7,'No hay ingresos registrados.');
}

async function showIngreso(id,event){
  rippleBtn(event.currentTarget,event);
  try{
    const item = normalizeIngreso(await apiRequest('/Ingresos/' + id));
    $('modalTitle').textContent = 'Detalle de ingreso';
    $('modalBody').innerHTML = `<p><strong>Fecha:</strong> ${escapeHtml(item.fecha)}</p><p><strong>Libro:</strong> ${escapeHtml(item.libro)}</p><p><strong>Lote:</strong> ${escapeHtml(item.lote)}</p><p><strong>Unidades:</strong> ${item.unidades}</p><p><strong>Valor de compra:</strong> ${money(item.compra)}</p><p><strong>Valor de venta publico:</strong> ${money(item.venta)}</p>`;
    openModal('modalInfo');
  }catch(error){ showToast(error.message); }
}

function filterIngresos(){
  const q = $('ingresosSearch').value.toLowerCase();
  const desde = $('ingresosDesde').value;
  const hasta = $('ingresosHasta').value;
  const list = state.ingresos.filter(item => {
    const text = (item.libro + ' ' + item.lote).toLowerCase();
    return text.includes(q) && (!desde || item.fecha >= desde) && (!hasta || item.fecha <= hasta);
  });
  renderIngresos(list);
}

async function saveLote(event){
  rippleBtn(event.currentTarget,event);
  const lote = $('loteId').value.trim();
  if(!lote) return showToast('Escribe el identificador del lote.');
  try{
    await apiRequest('/Lotes', {method:'POST', body:lote});
    $('loteId').value = '';
    await loadLotes();
    renderLotes();
    renderDashboardCards();
    showToast('Lote creado correctamente.');
  }catch(error){ showToast(error.message); }
}

function renderLotes(){
  const tbody = document.querySelector('#tblLotes tbody');
  tbody.innerHTML = state.lotes.length ? state.lotes.map(item => {
    const asociados = state.libros.filter(book => book.lote === item.lote).length;
    return `<tr><td><span class="badge badge-blue">${escapeHtml(item.lote)}</span></td><td>${item.actual ? 'Actual' : '-'}</td><td>${asociados}</td><td><span class="badge badge-gold">Sin eliminar API</span></td></tr>`;
  }).join('') : emptyRow(4,'No hay lotes registrados.');
}

async function saveUsuario(event){
  rippleBtn(event.currentTarget,event);
  const identificacion = $('usuarioId').value.trim();
  const nombres = $('usuarioNombre').value.trim();
  const email = $('usuarioCorreo').value.trim();
  const password = $('usuarioPass').value;
  const rol = Number($('usuarioRol').value);
  const activo = $('usuarioEstado').value === 'true';
  if(!nombres || !email || !rol) return showToast('Completa los datos obligatorios del usuario.');
  if(!emailValid(email)) return showToast('El correo del usuario no es valido.');
  try{
    if(editingUsuarioId){
      await apiRequest('/Usuarios/' + editingUsuarioId, {method:'PUT', body:{nombres,email,rol,activo}});
      showToast('Usuario actualizado correctamente.');
    }else{
      if(!identificacion || password.length < 8) return showToast('Identificacion y contrasena minima de 8 caracteres son obligatorias.');
      await apiRequest('/Usuarios', {method:'POST', body:{identificacion,nombres,email,password,rol}});
      showToast('Usuario registrado. Debe verificar el correo para activarse.');
    }
    clearUsuarioForm();
    await loadUsuarios();
    renderUsuarios();
  }catch(error){ showToast(error.message); }
}

function renderUsuarios(){
  const tbody = document.querySelector('#tblUsuarios tbody');
  if(!tbody) return;
  tbody.innerHTML = state.usuarios.length ? state.usuarios.map(item => `
    <tr><td>${escapeHtml(item.id)}</td><td>${escapeHtml(item.nombre)}</td><td>${escapeHtml(item.correo)}</td><td><span class="badge badge-blue">${escapeHtml(roleIds[item.rol] || 'Usuario')}</span></td><td><span class="badge ${item.estado ? 'badge-green' : 'badge-red'}">${item.estado ? 'Activo' : 'Inactivo'}</span></td><td><button class="btn btn-secondary btn-sm" onclick="editUsuario('${escapeHtml(item.id)}',event)">Editar</button> <button class="btn btn-danger btn-sm" onclick="toggleUsuario('${escapeHtml(item.id)}',event)">${item.estado ? 'Inactivar' : 'Activar'}</button></td></tr>
  `).join('') : emptyRow(6,'No hay usuarios registrados.');
}

function editUsuario(id,event){
  rippleBtn(event.currentTarget,event);
  const item = state.usuarios.find(usuario => usuario.id === id);
  if(!item) return;
  $('usuarioId').value = item.identificacion || item.id;
  $('usuarioId').disabled = true;
  $('usuarioNombre').value = item.nombre;
  $('usuarioCorreo').value = item.correo;
  $('usuarioPass').value = '';
  $('usuarioRol').value = item.rol;
  $('usuarioEstado').value = String(item.estado);
  editingUsuarioId = id;
}

function clearUsuarioForm(event){
  if(event) rippleBtn(event.currentTarget,event);
  ['usuarioId','usuarioNombre','usuarioCorreo','usuarioPass'].forEach(id => $(id).value = '');
  $('usuarioId').disabled = false;
  $('usuarioRol').value = '1';
  $('usuarioEstado').value = 'true';
  editingUsuarioId = null;
}

async function toggleUsuario(id,event){
  rippleBtn(event.currentTarget,event);
  const item = state.usuarios.find(usuario => usuario.id === id);
  if(!item) return;
  try{
    await apiRequest('/Usuarios/' + id + '/estado?activo=' + encodeURIComponent(!item.estado), {method:'PATCH'});
    await loadUsuarios();
    renderUsuarios();
    showToast('Estado de usuario actualizado.');
  }catch(error){ showToast(error.message); }
}

function exportLibros(event){
  rippleBtn(event.currentTarget,event);
  const rows = [['ID','Nombre','Nivel','Tipo','Edicion','Stock','Compra','Venta','Lote'],...state.libros.map(item => [item.id,item.nombre,item.nivel,typeName(item.tipoTexto || item.tipo),item.edicion,item.unidades,item.compra,item.venta,item.lote])];
  const csv = rows.map(row => row.map(value => `"${String(value).replaceAll('"','""')}"`).join(';')).join('\n');
  if(navigator.clipboard) navigator.clipboard.writeText(csv).then(() => showToast('Catalogo copiado como CSV.'));
  else{ console.log(csv); showToast('CSV generado en consola.'); }
}

function filterTable(input,tableId){
  const q = input.value.toLowerCase();
  document.querySelectorAll('#' + tableId + ' tbody tr').forEach(row => {
    row.style.display = row.textContent.toLowerCase().includes(q) ? '' : 'none';
  });
}

function confirmAction(title,text,callback){
  $('confirmTitle').textContent = title;
  $('confirmText').textContent = text;
  $('confirmActionBtn').onclick = () => { callback(); closeModal('modalConfirm'); };
  openModal('modalConfirm');
}

function rippleBtn(btn,event){
  if(!btn) return;
  const ripple = document.createElement('span');
  const rect = btn.getBoundingClientRect();
  const ev = event || window.event;
  ripple.className = 'ripple';
  ripple.style.left = ((ev && ev.clientX) ? ev.clientX - rect.left : rect.width / 2) + 'px';
  ripple.style.top = ((ev && ev.clientY) ? ev.clientY - rect.top : rect.height / 2) + 'px';
  btn.appendChild(ripple);
  setTimeout(() => ripple.remove(),600);
}

let toastTimer;
function showToast(message){
  $('toast').textContent = message;
  $('toast').classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('toast').classList.remove('show'),2800);
}

function openModal(id){ $(id).classList.add('open'); }
function closeModal(id){ $(id).classList.remove('open'); }

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.modal-overlay').forEach(modal => {
    modal.addEventListener('click', event => { if(event.target === modal) modal.classList.remove('open'); });
  });
  document.addEventListener('keydown', event => { if(event.key === 'Enter' && $('loginPage').style.display !== 'none') $('loginBtn').click(); });
  restoreSession();
});
