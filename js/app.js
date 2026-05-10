const $ = id => document.getElementById(id);

const roleNames = {
  admin: 'Administrador',
  bibliotecario: 'Bibliotecario / Operador',
  consulta: 'Consulta / Invitado'
};

const roleIds = {
  1: 'Administrador',
  2: 'Bibliotecario / Operador',
  3: 'Consulta / Invitado'
};

let currentUser = null;
let currentEmail = null;
let currentRole = 'admin';
let editingLibroId = null;
let editingUsuarioId = null;
let saleItems = [];

const defaultState = {
  libros: [
    {id:1,nombre:'Cálculo Integral',nivel:'Universitario',tipo:1,edicion:'3ra',unidades:24,ingresadas:30,compra:60000,venta:85000,lote:'LOTE-A'},
    {id:2,nombre:'Álgebra Lineal',nivel:'Universitario',tipo:1,edicion:'2da',unidades:5,ingresadas:20,compra:50000,venta:72000,lote:'LOTE-B'},
    {id:3,nombre:'Física I',nivel:'Básico',tipo:4,edicion:'1ra',unidades:0,ingresadas:10,compra:70000,venta:95000,lote:'LOTE-A'}
  ],
  clientes: [
    {id:'1001234567',nombre:'Ana Martínez',correo:'ana@cecar.edu.co',celular:'301 234 5678',nacimiento:'2000-05-12'},
    {id:'1009876543',nombre:'Carlos Pérez',correo:'carlos@gmail.com',celular:'315 987 6543',nacimiento:'1999-09-24'}
  ],
  ventas: [
    {comprobante:'COMP-001',cliente:'Ana Martínez',clienteId:'1001234567',fecha:'2026-05-01',observaciones:'Venta inicial',items:[{id:1,libro:'Cálculo Integral',lote:'LOTE-A',cantidad:2,total:170000}],total:170000},
    {comprobante:'COMP-002',cliente:'Carlos Pérez',clienteId:'1009876543',fecha:'2026-05-03',observaciones:'',items:[{id:2,libro:'Álgebra Lineal',lote:'LOTE-B',cantidad:1,total:72000}],total:72000}
  ],
  ingresos: [
    {id:1,fecha:'2026-04-15',libroId:1,libro:'Cálculo Integral',lote:'LOTE-A',unidades:30,compra:60000,venta:85000},
    {id:2,fecha:'2026-04-20',libroId:2,libro:'Álgebra Lineal',lote:'LOTE-B',unidades:20,compra:50000,venta:72000}
  ],
  lotes: [
    {lote:'LOTE-A',fecha:'2026-04-10'},
    {lote:'LOTE-B',fecha:'2026-04-18'}
  ],
  usuarios: [
    {id:'1',nombre:'Admin Principal',correo:'admin@cecar.edu.co',rol:1,estado:true},
    {id:'2',nombre:'María López',correo:'maria@cecar.edu.co',rol:2,estado:true},
    {id:'3',nombre:'Invitado Consulta',correo:'consulta@cecar.edu.co',rol:3,estado:true}
  ]
};

let state = loadState();

function loadState(){
  try{
    const saved = sessionStorage.getItem('bibliocecar-state');
    return saved ? JSON.parse(saved) : structuredClone(defaultState);
  }catch(error){
    return JSON.parse(JSON.stringify(defaultState));
  }
}

function persist(){
  sessionStorage.setItem('bibliocecar-state', JSON.stringify(state));
}

function money(n){
  return '$' + Number(n || 0).toLocaleString('es-CO');
}

function today(){
  return new Date().toISOString().slice(0,10);
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
  const types = {
    1:'Texto académico',
    2:'Investigación',
    3:'Literatura',
    4:'Referencia'
  };
  return types[type] || 'Sin tipo';
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

function nextBookId(){
  return Math.max(0, ...state.libros.map(book => Number(book.id))) + 1;
}

function nextIngresoId(){
  return Math.max(0, ...state.ingresos.map(item => Number(item.id || 0))) + 1;
}

function emptyRow(cols, message){
  return `<tr><td colspan="${cols}"><div class="empty-state">${message}</div></td></tr>`;
}

function canEdit(){
  return currentRole === 'admin' || currentRole === 'bibliotecario';
}

function doLogin(event){
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

  rippleBtn(btn,event);
  btn.innerHTML = '<span class="spinner"></span> Ingresando...';
  btn.disabled = true;

  setTimeout(() => {
    currentRole = $('loginRole').value;
    currentEmail = email;
    currentUser = email.split('@')[0];
    initApp();
  }, 700);
}

function initApp(){
  $('loginPage').style.display = 'none';
  $('appShell').style.display = 'flex';

  $('userNameDisplay').textContent = currentUser;
  $('userRoleDisplay').textContent = roleNames[currentRole];
  $('userAvatar').textContent = currentUser[0].toUpperCase();

  $('profileUser').value = currentUser;
  $('profileEmail').value = currentEmail;
  $('profileRoleInput').value = roleNames[currentRole];
  $('profileName').textContent = currentUser;
  $('profileRole').textContent = roleNames[currentRole];
  $('profileAvatar').textContent = currentUser[0].toUpperCase();

  applyRoleVisibility();
  applyEditorVisibility();
  renderAll();
  goHome();
  showToast('Bienvenido, ' + currentUser);
}

function doLogout(){
  $('appShell').style.display = 'none';
  $('loginPage').style.display = 'flex';
  $('loginBtn').innerHTML = 'Ingresar al sistema';
  $('loginBtn').disabled = false;
  $('loginEmail').value = '';
  $('loginPass').value = '';
  currentUser = null;
  currentEmail = null;
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
  persist();
}

function renderStats(){
  $('statLibros').textContent = state.libros.length;
  $('statStock').textContent = state.libros.reduce((acc,item) => acc + Number(item.unidades || 0),0);
  $('statClientes').textContent = state.clientes.length;
  $('statVentas').textContent = state.ventas.length;
}

function renderDashboardCards(){
  if(!$('modulesGrid')) return;

  const totalStock = state.libros.reduce((acc,item) => acc + Number(item.unidades || 0),0);

  $('dashLibrosMini').textContent = state.libros.length;
  $('dashStockMini').textContent = totalStock;
  $('dashVentasMini').textContent = state.ventas.length;
  $('dashLotesMini').textContent = state.lotes.length;

  $('modulesGrid').innerHTML = `
    <div class="dashboard-module" onclick="showPage('libros')">
      <div class="dashboard-module-top"><div class="icon">📚</div><strong>Libros</strong></div>
      <p>Registra títulos, tipo, edición, nivel, precios, lote y unidades.</p>
      <span>${state.libros.length} registrados</span>
    </div>
    <div class="dashboard-module" onclick="showPage('clientes')">
      <div class="dashboard-module-top"><div class="icon">👥</div><strong>Clientes</strong></div>
      <p>Administra compradores con identificación, correo y contacto.</p>
      <span>${state.clientes.length} clientes</span>
    </div>
    <div class="dashboard-module" onclick="showPage('ventas')">
      <div class="dashboard-module-top"><div class="icon">🛒</div><strong>Ventas</strong></div>
      <p>Registra comprobantes, agrega libros y descuenta inventario.</p>
      <span>${state.ventas.length} ventas</span>
    </div>
    <div class="dashboard-module" onclick="showPage('inventario')">
      <div class="dashboard-module-top"><div class="icon">📦</div><strong>Inventario</strong></div>
      <p>Consulta existencias por libro, lote, stock y estado.</p>
      <span>${totalStock} unidades</span>
    </div>
    <div class="dashboard-module" onclick="showPage('ingresos')">
      <div class="dashboard-module-top"><div class="icon">📥</div><strong>Ingresos</strong></div>
      <p>Registra entradas para aumentar existencias y actualizar precios.</p>
      <span>${state.ingresos.length} ingresos</span>
    </div>
    <div class="dashboard-module" onclick="showPage('lotes')">
      <div class="dashboard-module-top"><div class="icon">🏷️</div><strong>Lotes</strong></div>
      <p>Crea identificadores para organizar libros e inventario.</p>
      <span>${state.lotes.length} lotes</span>
    </div>
    <div class="dashboard-module role-admin" onclick="showPage('usuarios')">
      <div class="dashboard-module-top"><div class="icon">⚙️</div><strong>Usuarios</strong></div>
      <p>Administra cuentas, roles y estados de acceso.</p>
      <span>${state.usuarios.length} usuarios</span>
    </div>
  `;

  const lowStock = state.libros.filter(item => Number(item.unidades) <= 5).slice(0,4);
  $('dashLowStock').innerHTML = lowStock.length ? lowStock.map(item => `
    <div class="stock-item">
      <div>
        <strong>${escapeHtml(item.nombre)}</strong>
        <small>ID ${item.id} · ${escapeHtml(item.lote || 'Sin lote')}</small>
      </div>
      <span class="badge ${stockBadge(item.unidades)}">${stockText(item.unidades)}</span>
    </div>
  `).join('') : '<div class="empty-state">No hay libros con bajo stock.</div>';

  const recentVentas = state.ventas.slice(-2).reverse().map(item => ({
    title:'Venta ' + item.comprobante,
    detail:item.cliente + ' · ' + money(item.total),
    badge:'Venta'
  }));

  const recentIngresos = state.ingresos.slice(-2).reverse().map(item => ({
    title:'Ingreso de ' + item.libro,
    detail:item.unidades + ' unidades · ' + item.lote,
    badge:'Ingreso'
  }));

  const recent = [...recentVentas,...recentIngresos].slice(0,4);
  $('dashRecentActivity').innerHTML = recent.length ? recent.map(item => `
    <div class="activity-item">
      <div>
        <strong>${escapeHtml(item.title)}</strong>
        <small>${escapeHtml(item.detail)}</small>
      </div>
      <span class="badge badge-blue">${item.badge}</span>
    </div>
  `).join('') : '<div class="empty-state">Aún no hay actividad registrada.</div>';

  applyRoleVisibility();
}

function renderLibros(){
  const tbody = document.querySelector('#tblLibros tbody');

  tbody.innerHTML = state.libros.length ? state.libros.map(item => `
    <tr>
      <td>${item.id}</td>
      <td>${escapeHtml(item.nombre)}</td>
      <td>${escapeHtml(item.nivel)}</td>
      <td>${escapeHtml(typeName(item.tipo))}</td>
      <td>${escapeHtml(item.edicion)}</td>
      <td><span class="badge ${stockBadge(item.unidades)}">${item.unidades}</span></td>
      <td>${money(item.venta)}</td>
      <td>${escapeHtml(item.lote)}</td>
      <td>
        <button class="btn btn-secondary btn-sm" onclick="showLibro(${item.id},event)">👁</button>
        ${canEdit() ? `<button class="btn btn-secondary btn-sm" onclick="editLibro(${item.id},event)">✏️</button>
        <button class="btn btn-danger btn-sm" onclick="confirmDeleteLibro(${item.id},event)">🗑️</button>` : ''}
      </td>
    </tr>
  `).join('') : emptyRow(9,'No hay libros registrados.');
}

function saveLibro(event){
  rippleBtn(event.currentTarget,event);

  const nombre = $('libroNombre').value.trim();
  const nivel = $('libroNivel').value.trim();
  const tipo = Number($('libroTipo').value);
  const edicion = $('libroEdicion').value.trim();
  const unidades = Number($('libroUnidades').value);
  const lote = $('libroLote').value.trim();
  const compra = Number($('libroCompra').value);
  const venta = Number($('libroVenta').value);

  if(!nombre || !nivel || !tipo || !edicion || !lote) return showToast('Completa todos los campos obligatorios del libro.');
  if(unidades < 0 || Number.isNaN(unidades)) return showToast('Las unidades deben ser un número válido.');
  if(compra < 0 || venta < 0 || Number.isNaN(compra) || Number.isNaN(venta)) return showToast('Los valores deben ser números válidos.');

  const previous = state.libros.find(item => item.id === editingLibroId);
  const data = {
    id: editingLibroId || nextBookId(),
    nombre,
    nivel,
    tipo,
    edicion,
    unidades,
    ingresadas: previous ? Math.max(previous.ingresadas || 0, unidades) : unidades,
    compra,
    venta,
    lote
  };

  const index = state.libros.findIndex(item => item.id === data.id);
  if(index >= 0) state.libros[index] = {...state.libros[index],...data};
  else state.libros.push(data);

  if(!state.lotes.some(item => item.lote === lote)){
    state.lotes.push({lote,fecha:today()});
  }

  clearLibroForm();
  renderAll();
  showToast('Libro guardado correctamente.');
}

function editLibro(id,event){
  rippleBtn(event.currentTarget,event);

  const item = state.libros.find(book => book.id === id);
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
  editingLibroId = id;
  showToast('Libro listo para editar.');
}

function clearLibroForm(event){
  if(event) rippleBtn(event.currentTarget,event);

  ['libroNombre','libroNivel','libroTipo','libroEdicion','libroUnidades','libroLote','libroCompra','libroVenta'].forEach(id => $(id).value = '');
  $('libroFormTitle').textContent = 'Registrar / Actualizar Libro';
  editingLibroId = null;
}

function showLibro(id,event){
  rippleBtn(event.currentTarget,event);

  const item = state.libros.find(book => book.id === id);
  if(!item) return;

  $('modalTitle').textContent = 'Detalle del libro';
  $('modalBody').innerHTML = `
    <p><strong>ID:</strong> ${item.id}</p>
    <p><strong>Nombre:</strong> ${escapeHtml(item.nombre)}</p>
    <p><strong>Nivel:</strong> ${escapeHtml(item.nivel)}</p>
    <p><strong>Tipo:</strong> ${escapeHtml(typeName(item.tipo))}</p>
    <p><strong>Edición:</strong> ${escapeHtml(item.edicion)}</p>
    <p><strong>Lote:</strong> ${escapeHtml(item.lote)}</p>
    <p><strong>Stock:</strong> ${item.unidades}</p>
    <p><strong>Valor de compra:</strong> ${money(item.compra)}</p>
    <p><strong>Valor de venta público:</strong> ${money(item.venta)}</p>
  `;
  openModal('modalInfo');
}

function confirmDeleteLibro(id,event){
  rippleBtn(event.currentTarget,event);
  confirmAction('Eliminar libro','¿Seguro que deseas eliminar este libro?',() => {
    state.libros = state.libros.filter(item => item.id !== id);
    renderAll();
    showToast('Libro eliminado.');
  });
}

function renderClientes(){
  const tbody = document.querySelector('#tblClientes tbody');

  tbody.innerHTML = state.clientes.length ? state.clientes.map(item => `
    <tr>
      <td>${escapeHtml(item.id)}</td>
      <td>${escapeHtml(item.nombre)}</td>
      <td>${escapeHtml(item.correo)}</td>
      <td>${escapeHtml(item.celular)}</td>
      <td>
        <button class="btn btn-secondary btn-sm" onclick="showCliente('${escapeHtml(item.id)}',event)">👁</button>
        <button class="btn btn-secondary btn-sm" onclick="editCliente('${escapeHtml(item.id)}',event)">✏️</button>
        <button class="btn btn-danger btn-sm" onclick="confirmDeleteCliente('${escapeHtml(item.id)}',event)">🗑️</button>
      </td>
    </tr>
  `).join('') : emptyRow(5,'No hay clientes registrados.');
}

function saveCliente(event){
  rippleBtn(event.currentTarget,event);

  const data = {
    id:$('clienteId').value.trim(),
    nombre:$('clienteNombre').value.trim(),
    correo:$('clienteCorreo').value.trim(),
    celular:$('clienteCelular').value.trim(),
    nacimiento:$('clienteNacimiento').value
  };

  if(!data.id || !data.nombre || !data.correo || !data.celular || !data.nacimiento) return showToast('Completa todos los datos del cliente.');
  if(!emailValid(data.correo)) return showToast('El correo del cliente no es válido.');

  const index = state.clientes.findIndex(item => item.id === data.id);
  if(index >= 0) state.clientes[index] = data;
  else state.clientes.push(data);

  clearClienteForm();
  renderAll();
  showToast('Cliente guardado correctamente.');
}

function editCliente(id,event){
  rippleBtn(event.currentTarget,event);

  const item = state.clientes.find(cliente => cliente.id === id);
  if(!item) return;

  $('clienteId').value = item.id;
  $('clienteNombre').value = item.nombre;
  $('clienteCorreo').value = item.correo;
  $('clienteCelular').value = item.celular;
  $('clienteNacimiento').value = item.nacimiento;
  showToast('Cliente listo para editar.');
}

function clearClienteForm(event){
  if(event) rippleBtn(event.currentTarget,event);
  ['clienteId','clienteNombre','clienteCorreo','clienteCelular','clienteNacimiento'].forEach(id => $(id).value = '');
}

function showCliente(id,event){
  rippleBtn(event.currentTarget,event);

  const item = state.clientes.find(cliente => cliente.id === id);
  if(!item) return;

  $('modalTitle').textContent = 'Detalle del cliente';
  $('modalBody').innerHTML = `
    <p><strong>Identificación:</strong> ${escapeHtml(item.id)}</p>
    <p><strong>Nombre:</strong> ${escapeHtml(item.nombre)}</p>
    <p><strong>Correo:</strong> ${escapeHtml(item.correo)}</p>
    <p><strong>Celular:</strong> ${escapeHtml(item.celular)}</p>
    <p><strong>Fecha de nacimiento:</strong> ${escapeHtml(item.nacimiento)}</p>
  `;
  openModal('modalInfo');
}

function confirmDeleteCliente(id,event){
  rippleBtn(event.currentTarget,event);
  confirmAction('Eliminar cliente','¿Seguro que deseas eliminar este cliente?',() => {
    state.clientes = state.clientes.filter(item => item.id !== id);
    renderAll();
    showToast('Cliente eliminado.');
  });
}

function addSaleItem(event){
  rippleBtn(event.currentTarget,event);

  const libro = state.libros.find(item => item.id === Number($('ventaLibroId').value));
  const lote = $('ventaLote').value.trim();
  const cantidad = Number($('ventaCantidad').value || 1);

  if(!libro) return showToast('No existe un libro con ese ID.');
  if(!lote) return showToast('Escribe el lote del libro.');
  if(libro.lote !== lote) return showToast('El lote no coincide con el libro seleccionado.');
  if(cantidad <= 0 || Number.isNaN(cantidad)) return showToast('La cantidad debe ser mayor a cero.');

  const reserved = saleItems.filter(item => item.id === libro.id).reduce((acc,item) => acc + item.cantidad,0);
  if(libro.unidades < cantidad + reserved) return showToast('Stock insuficiente para este libro.');

  saleItems.push({id:libro.id,libro:libro.nombre,lote,cantidad,total:libro.venta * cantidad});

  $('ventaLibroId').value = '';
  $('ventaLote').value = '';
  $('ventaCantidad').value = '';
  renderSalePreview();
  showToast('Ítem agregado a la venta.');
}

function renderSalePreview(){
  const box = $('saleItemsPreview');
  if(!box) return;

  const total = saleItems.reduce((acc,item) => acc + item.total,0);

  box.innerHTML = saleItems.length ? `
    ${saleItems.map((item,index) => `
      <div class="sale-item-chip">
        <span>${escapeHtml(item.libro)} · ${escapeHtml(item.lote)} · x${item.cantidad} - ${money(item.total)}</span>
        <button class="btn btn-danger btn-sm" onclick="removeSaleItem(${index},event)">Quitar</button>
      </div>
    `).join('')}
    <div class="sale-total">Total: ${money(total)}</div>
  ` : '<span style="font-size:12px;color:var(--muted)">Sin ítems agregados</span>';
}

function removeSaleItem(index,event){
  rippleBtn(event.currentTarget,event);
  saleItems.splice(index,1);
  renderSalePreview();
}

function saveVenta(event){
  rippleBtn(event.currentTarget,event);

  const cliente = state.clientes.find(item => item.id === $('ventaCliente').value.trim());
  const comprobante = $('ventaComprobante').value.trim();

  if(!cliente) return showToast('Cliente no encontrado.');
  if(!comprobante) return showToast('Escribe el número de comprobante.');
  if(state.ventas.some(item => item.comprobante === comprobante)) return showToast('Ese comprobante ya existe.');
  if(!saleItems.length) return showToast('Agrega al menos un ítem.');

  for(const item of saleItems){
    const libro = state.libros.find(book => book.id === item.id);
    if(!libro || libro.unidades < item.cantidad) return showToast('Stock insuficiente en ' + item.libro);
  }

  saleItems.forEach(item => {
    const libro = state.libros.find(book => book.id === item.id);
    libro.unidades -= item.cantidad;
  });

  const total = saleItems.reduce((acc,item) => acc + item.total,0);

  state.ventas.push({
    comprobante,
    cliente:cliente.nombre,
    clienteId:cliente.id,
    fecha:today(),
    observaciones:$('ventaObs').value.trim(),
    items:[...saleItems],
    total
  });

  saleItems = [];
  ['ventaCliente','ventaComprobante','ventaObs','ventaLibroId','ventaLote','ventaCantidad'].forEach(id => $(id).value = '');
  renderAll();
  showToast('Venta registrada y stock actualizado.');
}

function renderVentas(list = state.ventas){
  const tbody = document.querySelector('#tblVentas tbody');

  tbody.innerHTML = list.length ? list.map(item => `
    <tr>
      <td>${escapeHtml(item.comprobante)}</td>
      <td>${escapeHtml(item.cliente)}</td>
      <td>${escapeHtml(item.fecha)}</td>
      <td>${item.items.length} libro(s)</td>
      <td>${money(item.total)}</td>
      <td>
        <button class="btn btn-secondary btn-sm" onclick="showVenta('${escapeHtml(item.comprobante)}',event)">👁</button>
        <button class="btn btn-danger btn-sm" onclick="confirmDeleteVenta('${escapeHtml(item.comprobante)}',event)">🗑️</button>
      </td>
    </tr>
  `).join('') : emptyRow(6,'No hay ventas registradas.');
}

function showVenta(comprobante,event){
  rippleBtn(event.currentTarget,event);

  const item = state.ventas.find(venta => venta.comprobante === comprobante);
  if(!item) return;

  $('modalTitle').textContent = 'Detalle de venta';
  $('modalBody').innerHTML = `
    <p><strong>Comprobante:</strong> ${escapeHtml(item.comprobante)}</p>
    <p><strong>Cliente:</strong> ${escapeHtml(item.cliente)}</p>
    <p><strong>Fecha:</strong> ${escapeHtml(item.fecha)}</p>
    <p><strong>Total:</strong> ${money(item.total)}</p>
    <p><strong>Ítems:</strong></p>
    <ul>
      ${item.items.map(row => `<li>${escapeHtml(row.libro)} · ${escapeHtml(row.lote)} · x${row.cantidad} - ${money(row.total)}</li>`).join('')}
    </ul>
    ${item.observaciones ? `<p><strong>Observaciones:</strong> ${escapeHtml(item.observaciones)}</p>` : ''}
  `;
  openModal('modalInfo');
}

function confirmDeleteVenta(comprobante,event){
  rippleBtn(event.currentTarget,event);
  confirmAction('Eliminar venta','¿Seguro que deseas eliminar esta venta? El stock será restaurado.',() => {
    const venta = state.ventas.find(item => item.comprobante === comprobante);
    if(!venta) return;

    venta.items.forEach(item => {
      const libro = state.libros.find(book => book.id === item.id);
      if(libro) libro.unidades += item.cantidad;
    });

    state.ventas = state.ventas.filter(item => item.comprobante !== comprobante);
    renderAll();
    showToast('Venta eliminada y stock restaurado.');
  });
}

function filterVentas(){
  const q = $('ventasSearch').value.toLowerCase();
  const desde = $('ventasDesde').value;
  const hasta = $('ventasHasta').value;

  const list = state.ventas.filter(item => {
    const text = (item.comprobante + ' ' + item.cliente + ' ' + item.items.map(row => row.libro).join(' ')).toLowerCase();
    return text.includes(q) && (!desde || item.fecha >= desde) && (!hasta || item.fecha <= hasta);
  });

  renderVentas(list);
}

function renderInventario(){
  const tbody = document.querySelector('#tblInventario tbody');

  tbody.innerHTML = state.libros.length ? state.libros.map(item => `
    <tr>
      <td>${item.id}</td>
      <td>${escapeHtml(item.lote)}</td>
      <td>${escapeHtml(item.nombre)}</td>
      <td>${item.ingresadas || 0}</td>
      <td><span class="badge ${stockBadge(item.unidades)}">${item.unidades}</span></td>
      <td><span class="badge ${stockBadge(item.unidades)}">${stockText(item.unidades)}</span></td>
    </tr>
  `).join('') : emptyRow(6,'No hay inventario disponible.');
}

function refreshInventario(event){
  rippleBtn(event.currentTarget,event);
  renderInventario();
  showToast('Inventario actualizado.');
}

function saveIngreso(event){
  rippleBtn(event.currentTarget,event);

  const libro = state.libros.find(item => item.id === Number($('ingresoLibroId').value));
  const unidades = Number($('ingresoUnidades').value || 0);
  const lote = $('ingresoLote').value.trim();
  const compra = Number($('ingresoCompra').value);
  const venta = Number($('ingresoVenta').value);

  if(!libro) return showToast('No existe un libro con ese ID.');
  if(unidades <= 0 || Number.isNaN(unidades)) return showToast('Las unidades deben ser mayores a cero.');
  if(!lote) return showToast('Escribe el lote del ingreso.');
  if(compra < 0 || venta < 0 || Number.isNaN(compra) || Number.isNaN(venta)) return showToast('Los valores deben ser válidos.');

  libro.unidades += unidades;
  libro.ingresadas = Number(libro.ingresadas || 0) + unidades;
  libro.lote = lote;
  libro.compra = compra;
  libro.venta = venta;

  state.ingresos.push({
    id:nextIngresoId(),
    fecha:today(),
    libroId:libro.id,
    libro:libro.nombre,
    lote,
    unidades,
    compra,
    venta
  });

  if(!state.lotes.some(item => item.lote === lote)){
    state.lotes.push({lote,fecha:today()});
  }

  ['ingresoLibroId','ingresoUnidades','ingresoLote','ingresoCompra','ingresoVenta'].forEach(id => $(id).value = '');
  renderAll();
  showToast('Ingreso registrado correctamente.');
}

function renderIngresos(list = state.ingresos){
  const tbody = document.querySelector('#tblIngresos tbody');

  tbody.innerHTML = list.length ? list.map(item => `
    <tr>
      <td>${escapeHtml(item.fecha)}</td>
      <td>${escapeHtml(item.libro)}</td>
      <td>${escapeHtml(item.lote)}</td>
      <td>${item.unidades}</td>
      <td>${money(item.compra)}</td>
      <td>${money(item.venta)}</td>
      <td><button class="btn btn-secondary btn-sm" onclick="showIngreso(${item.id},event)">👁</button></td>
    </tr>
  `).join('') : emptyRow(7,'No hay ingresos registrados.');
}

function showIngreso(id,event){
  rippleBtn(event.currentTarget,event);

  const item = state.ingresos.find(ingreso => ingreso.id === id);
  if(!item) return;

  $('modalTitle').textContent = 'Detalle de ingreso';
  $('modalBody').innerHTML = `
    <p><strong>Fecha:</strong> ${escapeHtml(item.fecha)}</p>
    <p><strong>Libro:</strong> ${escapeHtml(item.libro)}</p>
    <p><strong>Lote:</strong> ${escapeHtml(item.lote)}</p>
    <p><strong>Unidades:</strong> ${item.unidades}</p>
    <p><strong>Valor de compra:</strong> ${money(item.compra)}</p>
    <p><strong>Valor de venta público:</strong> ${money(item.venta)}</p>
  `;
  openModal('modalInfo');
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

function saveLote(event){
  rippleBtn(event.currentTarget,event);

  const lote = $('loteId').value.trim();
  if(!lote) return showToast('Escribe el identificador del lote.');
  if(state.lotes.some(item => item.lote === lote)) return showToast('Ese lote ya existe.');

  state.lotes.push({lote,fecha:today()});
  $('loteId').value = '';
  renderAll();
  showToast('Lote creado correctamente.');
}

function renderLotes(){
  const tbody = document.querySelector('#tblLotes tbody');

  tbody.innerHTML = state.lotes.length ? state.lotes.map(item => {
    const asociados = state.libros.filter(book => book.lote === item.lote).length;

    return `
      <tr>
        <td><span class="badge badge-blue">${escapeHtml(item.lote)}</span></td>
        <td>${escapeHtml(item.fecha)}</td>
        <td>${asociados}</td>
        <td><button class="btn btn-danger btn-sm" onclick="confirmDeleteLote('${escapeHtml(item.lote)}',event)">🗑️</button></td>
      </tr>
    `;
  }).join('') : emptyRow(4,'No hay lotes registrados.');
}

function confirmDeleteLote(lote,event){
  rippleBtn(event.currentTarget,event);

  if(state.libros.some(item => item.lote === lote)){
    showToast('No puedes eliminar un lote con libros asociados.');
    return;
  }

  confirmAction('Eliminar lote','¿Seguro que deseas eliminar este lote?',() => {
    state.lotes = state.lotes.filter(item => item.lote !== lote);
    renderAll();
    showToast('Lote eliminado.');
  });
}

function saveUsuario(event){
  rippleBtn(event.currentTarget,event);

  const nombre = $('usuarioNombre').value.trim();
  const correo = $('usuarioCorreo').value.trim();
  const pass = $('usuarioPass').value;
  const rol = Number($('usuarioRol').value);
  const estado = $('usuarioEstado').value === 'true';
  const id = editingUsuarioId || $('usuarioId').value.trim() || Date.now().toString();

  if(!nombre || !correo || !rol) return showToast('Completa los datos obligatorios del usuario.');
  if(!emailValid(correo)) return showToast('El correo del usuario no es válido.');
  if(!editingUsuarioId && pass.length < 4) return showToast('La contraseña debe tener mínimo 4 caracteres.');

  const data = {id,nombre,correo,rol,estado};
  const index = state.usuarios.findIndex(item => item.id === id);

  if(index >= 0) state.usuarios[index] = data;
  else state.usuarios.push(data);

  clearUsuarioForm();
  renderAll();
  showToast('Usuario guardado correctamente.');
}

function renderUsuarios(){
  const tbody = document.querySelector('#tblUsuarios tbody');

  tbody.innerHTML = state.usuarios.length ? state.usuarios.map(item => `
    <tr>
      <td>${escapeHtml(item.id)}</td>
      <td>${escapeHtml(item.nombre)}</td>
      <td>${escapeHtml(item.correo)}</td>
      <td><span class="badge badge-blue">${escapeHtml(roleIds[item.rol])}</span></td>
      <td><span class="badge ${item.estado ? 'badge-green' : 'badge-red'}">${item.estado ? 'Activo' : 'Inactivo'}</span></td>
      <td>
        <button class="btn btn-secondary btn-sm" onclick="editUsuario('${escapeHtml(item.id)}',event)">✏️</button>
        <button class="btn btn-danger btn-sm" onclick="toggleUsuario('${escapeHtml(item.id)}',event)">🚫</button>
      </td>
    </tr>
  `).join('') : emptyRow(6,'No hay usuarios registrados.');
}

function editUsuario(id,event){
  rippleBtn(event.currentTarget,event);

  const item = state.usuarios.find(usuario => usuario.id === id);
  if(!item) return;

  $('usuarioId').value = item.id;
  $('usuarioNombre').value = item.nombre;
  $('usuarioCorreo').value = item.correo;
  $('usuarioPass').value = '';
  $('usuarioRol').value = item.rol;
  $('usuarioEstado').value = String(item.estado);
  editingUsuarioId = id;
  showToast('Usuario listo para editar.');
}

function clearUsuarioForm(event){
  if(event) rippleBtn(event.currentTarget,event);

  ['usuarioId','usuarioNombre','usuarioCorreo','usuarioPass'].forEach(id => $(id).value = '');
  $('usuarioRol').value = '1';
  $('usuarioEstado').value = 'true';
  editingUsuarioId = null;
}

function toggleUsuario(id,event){
  rippleBtn(event.currentTarget,event);

  const item = state.usuarios.find(usuario => usuario.id === id);
  if(!item) return;

  item.estado = !item.estado;
  renderAll();
  showToast('Estado de usuario actualizado.');
}

function exportLibros(event){
  rippleBtn(event.currentTarget,event);

  const rows = [
    ['ID','Nombre','Nivel','Tipo','Edición','Stock','Compra','Venta','Lote'],
    ...state.libros.map(item => [item.id,item.nombre,item.nivel,typeName(item.tipo),item.edicion,item.unidades,item.compra,item.venta,item.lote])
  ];

  const csv = rows.map(row => row.map(value => `"${String(value).replaceAll('"','""')}"`).join(';')).join('\n');

  if(navigator.clipboard){
    navigator.clipboard.writeText(csv).then(() => showToast('Catálogo copiado como CSV.'));
  }else{
    console.log(csv);
    showToast('CSV generado en consola.');
  }
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
  $('confirmActionBtn').onclick = () => {
    callback();
    closeModal('modalConfirm');
  };
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

function openModal(id){
  $(id).classList.add('open');
}

function closeModal(id){
  $(id).classList.remove('open');
}

document.addEventListener('DOMContentLoaded', () => {
  renderAll();

  document.querySelectorAll('.modal-overlay').forEach(modal => {
    modal.addEventListener('click', event => {
      if(event.target === modal) modal.classList.remove('open');
    });
  });

  document.addEventListener('keydown', event => {
    if(event.key === 'Enter' && $('loginPage').style.display !== 'none'){
      $('loginBtn').click();
    }
  });
});
