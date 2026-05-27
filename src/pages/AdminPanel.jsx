import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, doc, setDoc, addDoc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { read, utils } from 'xlsx';
import { 
  Users, UserPlus, FileSpreadsheet, PlusCircle, CheckCircle, Edit3, Trash2, 
  Settings, Award, HelpCircle, ArrowLeft, Plus, Upload, Play, Check, X, AlertOctagon 
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminPanel() {
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // Tab state
  const [activeTab, setActiveTab] = useState('teams');

  // Firestore collections state
  const [teams, setTeams] = useState([]);
  const [leads, setLeads] = useState([]);
  const [manualScores, setManualScores] = useState({});
  const [pointsConfig, setPointsConfig] = useState({
    approval: 200,
    application: 75,
    virtualMeetings: 5,
    ogxSignUps: 1,
    digitalCampaigns: 5,
    physicalCampaigns: 20,
    physicalAttendance: 5
  });

  // Modal / Form state for Teams
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [teamModalMode, setTeamModalMode] = useState('add'); // 'add' or 'edit'
  const [editingTeamId, setEditingTeamId] = useState('');
  const [teamForm, setTeamForm] = useState({ name: '', type: 'oGV' });

  // Members Management state
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [newMemberName, setNewMemberName] = useState('');

  // Leads Import states
  const [importSourceMode, setImportSourceMode] = useState('paste'); // 'file' or 'paste'
  const [pastedData, setPastedData] = useState('');
  const [parsedPreviewLeads, setParsedPreviewLeads] = useState([]);
  const [allocateImportTeamId, setAllocateImportTeamId] = useState('');
  const [fileInputRef, setFileInputRef] = useState(null);

  // Leads Filters
  const [filterTeamId, setFilterTeamId] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Check sessionStorage
  useEffect(() => {
    const isAuth = sessionStorage.getItem('airborne_admin_auth');
    if (isAuth === 'true') {
      setIsAdminLoggedIn(true);
    }
  }, []);

  // Fetch Firestore data
  useEffect(() => {
    const unsubTeams = onSnapshot(collection(db, 'teams'), (snapshot) => {
      const list = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      setTeams(list.sort((a, b) => a.name.localeCompare(b.name)));
    });

    const unsubLeads = onSnapshot(collection(db, 'leads'), (snapshot) => {
      const list = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      setLeads(list);
    });

    const unsubManual = onSnapshot(collection(db, 'manualScores'), (snapshot) => {
      const obj = {};
      snapshot.forEach((doc) => {
        obj[doc.id] = doc.data();
      });
      setManualScores(obj);
    });

    const unsubPoints = onSnapshot(doc(db, 'pointsConfig', 'default'), (snap) => {
      if (snap.exists()) {
        setPointsConfig(snap.data());
      }
    });

    return () => {
      unsubTeams();
      unsubLeads();
      unsubManual();
      unsubPoints();
    };
  }, []);

  // Admin login handler
  const handleAdminLogin = (e) => {
    e.preventDefault();
    if (username === 'admin' && password === 'airborne@admin2026') {
      sessionStorage.setItem('airborne_admin_auth', 'true');
      setIsAdminLoggedIn(true);
      toast.success("Welcome Commander! Authenticated successfully.");
    } else {
      toast.error("Unauthorized access. Check credentials.");
    }
  };

  // Admin logout handler
  const handleAdminLogout = () => {
    sessionStorage.removeItem('airborne_admin_auth');
    setIsAdminLoggedIn(false);
    toast.success("Safely logged out of Admin Deck");
  };

  // ================= TAB 1: TEAMS CRUD =================
  const openAddTeamModal = () => {
    setTeamModalMode('add');
    setTeamForm({ name: '', type: 'oGV' });
    setShowTeamModal(true);
  };

  const openEditTeamModal = (team) => {
    setTeamModalMode('edit');
    setEditingTeamId(team.id);
    setTeamForm({ name: team.name, type: team.type });
    setShowTeamModal(true);
  };

  const handleTeamSubmit = async (e) => {
    e.preventDefault();
    if (!teamForm.name.trim()) {
      toast.error("Team Name is required");
      return;
    }

    try {
      if (teamModalMode === 'add') {
        const docRef = await addDoc(collection(db, 'teams'), {
          name: teamForm.name.trim(),
          type: teamForm.type,
          createdAt: new Date(),
          members: []
        });
        toast.success(`Team "${teamForm.name}" deployed!`);
      } else {
        await updateDoc(doc(db, 'teams', editingTeamId), {
          name: teamForm.name.trim(),
          type: teamForm.type
        });
        toast.success(`Team updated successfully`);
      }
      setShowTeamModal(false);
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Operation failed");
    }
  };

  const handleDeleteTeam = async (teamId, name) => {
    if (window.confirm(`Are you absolutely sure you want to decommission Team "${name}"? All member allocations will be removed!`)) {
      try {
        await deleteDoc(doc(db, 'teams', teamId));
        toast.success(`Team "${name}" decommissioned`);
      } catch (err) {
        console.error(err);
        toast.error(err.message || "Decommission failed");
      }
    }
  };

  // ================= TAB 2: MEMBERS =================
  const handleAddMember = async () => {
    if (!selectedTeamId) {
      toast.error("Select a team first");
      return;
    }
    if (!newMemberName.trim()) {
      toast.error("Enter a name");
      return;
    }

    const team = teams.find(t => t.id === selectedTeamId);
    if (!team) return;

    const currentMembers = team.members || [];
    if (currentMembers.includes(newMemberName.trim())) {
      toast.error("Member already exists in this team");
      return;
    }

    try {
      await updateDoc(doc(db, 'teams', selectedTeamId), {
        members: [...currentMembers, newMemberName.trim()]
      });
      setNewMemberName('');
      toast.success(`${newMemberName} added to roster`);
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Failed to add member");
    }
  };

  const handleDeleteMember = async (memberName) => {
    if (!selectedTeamId) return;
    const team = teams.find(t => t.id === selectedTeamId);
    if (!team) return;

    if (window.confirm(`Remove ${memberName} from team list?`)) {
      try {
        const updatedMembers = (team.members || []).filter(m => m !== memberName);
        await updateDoc(doc(db, 'teams', selectedTeamId), {
          members: updatedMembers
        });
        toast.success(`${memberName} discharged from roster`);
      } catch (err) {
        console.error(err);
        toast.error(err.message || "Failed to remove member");
      }
    }
  };

  // ================= TAB 3: LEADS IMPORT & GRID =================
  // Parse copy-pasted Excel Tab-Separated Values (TSV)
  const parsePastedTSV = () => {
    if (!pastedData.trim()) {
      toast.error("Paste some data first");
      return;
    }

    try {
      const rows = pastedData.split(/\r?\n/);
      const leadsList = [];

      rows.forEach(row => {
        if (!row.trim()) return;
        const columns = row.split('\t');
        if (columns.length > 0) {
          leadsList.push({
            firstName: columns[0]?.trim() || '',
            lastName: columns[1]?.trim() || '',
            email: columns[2]?.trim() || '',
            contactNumber: columns[3]?.trim() || ''
          });
        }
      });

      if (leadsList.length === 0) {
        toast.error("Could not parse any columns. Check format.");
      } else {
        setParsedPreviewLeads(leadsList);
        toast.success(`Successfully parsed ${leadsList.length} rows for preview`);
      }
    } catch (err) {
      console.error(err);
      toast.error("Parsing failed. Ensure it is tab-separated.");
    }
  };

  // Parse Uploaded Excel file (.xlsx)
  const handleExcelFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target.result;
        const workbook = read(data, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const json = utils.sheet_to_json(worksheet, { header: 1 });
        
        const leadsList = [];
        json.forEach((row, index) => {
          // Skip header if it is non-data
          if (index === 0 && (row[0] === 'First Name' || row[0] === 'firstName')) return;
          if (row.length > 0 && (row[0] || row[1])) {
            leadsList.push({
              firstName: String(row[0] || '').trim(),
              lastName: String(row[1] || '').trim(),
              email: String(row[2] || '').trim(),
              contactNumber: String(row[3] || '').trim()
            });
          }
        });

        if (leadsList.length === 0) {
          toast.error("No valid lead rows found in sheet");
        } else {
          setParsedPreviewLeads(leadsList);
          toast.success(`Parsed ${leadsList.length} leads from spreadsheet`);
        }
      } catch (err) {
        console.error(err);
        toast.error("Error reading excel file");
      }
    };
    reader.readAsBinaryString(file);
  };

  // Commit Leads Import to Firestore
  const handleCommitLeadsImport = async () => {
    if (parsedPreviewLeads.length === 0) {
      toast.error("No leads to import");
      return;
    }

    try {
      const batch = writeBatch(db);
      
      parsedPreviewLeads.forEach(lead => {
        const newLeadRef = doc(collection(db, 'leads'));
        batch.set(newLeadRef, {
          firstName: lead.firstName,
          lastName: lead.lastName,
          email: lead.email,
          contactNumber: lead.contactNumber,
          allocatedTeam: allocateImportTeamId || '',
          approachedBy: '',
          status: '—',
          remarks: '',
          adminApproved: false,
          adminRejected: false,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      });

      await batch.commit();
      if (allocateImportTeamId) {
        toast.success(`Imported and allocated ${parsedPreviewLeads.length} leads successfully!`);
      } else {
        toast.success(`Imported ${parsedPreviewLeads.length} leads as unassigned!`);
      }
      
      // Reset
      setParsedPreviewLeads([]);
      setPastedData('');
      if (fileInputRef) fileInputRef.value = '';
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Import operation failed");
    }
  };

  // Re-allocate a specific lead
  const handleLeadReallocation = async (leadId, newTeamId) => {
    try {
      await updateDoc(doc(db, 'leads', leadId), {
        allocatedTeam: newTeamId,
        // Reset assignment if reallocated
        approachedBy: '',
        status: '—',
        adminApproved: false,
        adminRejected: false
      });
      toast.success("Lead reallocated successfully");
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Allocation change failed");
    }
  };

  // Delete a lead
  const handleDeleteLead = async (leadId, name) => {
    if (window.confirm(`Delete lead "${name}" permanently?`)) {
      try {
        await deleteDoc(doc(db, 'leads', leadId));
        toast.success(`Lead "${name}" deleted`);
      } catch (err) {
        console.error(err);
        toast.error(err.message || "Failed to delete lead");
      }
    }
  };

  // ================= TAB 4: MANUAL SCORES =================
  const handleManualScoreChange = async (teamId, metric, val) => {
    const numericVal = Math.max(0, parseInt(val) || 0);
    
    // Optimistic local state update to keep typing instant
    const updated = {
      ...(manualScores[teamId] || {
        virtualMeetings: 0,
        ogxSignUps: 0,
        digitalCampaigns: 0,
        physicalCampaigns: 0,
        physicalAttendance: 0,
        innovationsScore: 0
      }),
      [metric]: numericVal,
      updatedAt: new Date()
    };

    setManualScores(prev => ({
      ...prev,
      [teamId]: updated
    }));

    // Save to Firestore
    try {
      await setDoc(doc(db, 'manualScores', teamId), updated, { merge: true });
    } catch (e) {
      console.error("Manual score save error:", e);
    }
  };

  const calculatePointsPreview = (teamId) => {
    const scores = manualScores[teamId] || {
      virtualMeetings: 0,
      ogxSignUps: 0,
      digitalCampaigns: 0,
      physicalCampaigns: 0,
      physicalAttendance: 0,
      innovationsScore: 0
    };

    return (
      (scores.virtualMeetings || 0) * (pointsConfig.virtualMeetings || 5) +
      (scores.ogxSignUps || 0) * (pointsConfig.ogxSignUps || 1) +
      (scores.digitalCampaigns || 0) * (pointsConfig.digitalCampaigns || 5) +
      (scores.physicalCampaigns || 0) * (pointsConfig.physicalCampaigns || 20) +
      (scores.physicalAttendance || 0) * (pointsConfig.physicalAttendance || 5) +
      (scores.innovationsScore || 0)
    );
  };

  // ================= TAB 5: POINTS SYSTEM =================
  const handlePointsChange = (field, val) => {
    const num = Math.max(0, parseInt(val) || 0);
    setPointsConfig(prev => ({
      ...prev,
      [field]: num
    }));
  };

  const savePointsConfig = async () => {
    try {
      await setDoc(doc(db, 'pointsConfig', 'default'), {
        ...pointsConfig,
        updatedAt: new Date()
      });
      toast.success("Points Matrix updated live!");
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Failed to update points config");
    }
  };

  // ================= TAB 6: PENDING APPROVALS =================
  const pendingLeads = leads.filter(l => (l.status === 'Applied' || l.status === 'Approved') && !l.adminApproved);

  const handleApproveLead = async (leadId) => {
    try {
      await updateDoc(doc(db, 'leads', leadId), {
        adminApproved: true,
        adminRejected: false,
        updatedAt: new Date()
      });
      toast.success("Lead conversion approved!");
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Failed to approve");
    }
  };

  const handleRejectLead = async (leadId) => {
    try {
      await updateDoc(doc(db, 'leads', leadId), {
        status: 'Cold Call Taken', // Reverts to Cold Call Taken
        adminApproved: false,
        adminRejected: true,
        updatedAt: new Date()
      });
      toast.success("Lead reverted. Team notified.");
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Failed to reject");
    }
  };

  const handleBulkApprove = async () => {
    if (pendingLeads.length === 0) return;
    try {
      const batch = writeBatch(db);
      pendingLeads.forEach(lead => {
        batch.update(doc(db, 'leads', lead.id), {
          adminApproved: true,
          adminRejected: false,
          updatedAt: new Date()
        });
      });
      await batch.commit();
      toast.success(`Bulk approved ${pendingLeads.length} entries!`);
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Bulk approval failed");
    }
  };

  // Filter main leads lists
  const filteredMainLeads = leads.filter(l => {
    const matchTeam = filterTeamId 
      ? (filterTeamId === 'unassigned' ? (!l.allocatedTeam || l.allocatedTeam === 'unassigned') : l.allocatedTeam === filterTeamId)
      : true;
    const matchStatus = filterStatus ? l.status === filterStatus : true;
    return matchTeam && matchStatus;
  });

  // ================= ADMIN LOGIN SCREEN =================
  if (!isAdminLoggedIn) {
    return (
      <div className="app-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ position: 'absolute', top: '2rem', left: '2rem' }}>
          <Link to="/" style={{ 
            color: 'var(--color-text-secondary)', 
            textDecoration: 'none', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.5rem',
            fontSize: '0.9rem',
            fontWeight: '500'
          }}>
            <ArrowLeft size={16} /> Back to Main Page
          </Link>
        </div>

        <div className="card" style={{ width: '100%', maxWidth: '420px', padding: '2.5rem 2rem' }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div style={{
              background: 'white',
              color: 'var(--color-primary)',
              width: '48px',
              height: '48px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.8rem',
              fontWeight: '800',
              margin: '0 auto 1rem auto',
              boxShadow: '0 0 20px rgba(255, 255, 255, 0.1)'
            }}>A</div>
            <h1 style={{ fontSize: '1.5rem', color: '#fff', marginBottom: '0.25rem' }}>Project Airborne</h1>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>ADMIN DECK ACCESS</p>
          </div>

          <form onSubmit={handleAdminLogin}>
            <div className="input-group">
              <label className="input-label">Username</label>
              <input 
                type="text" 
                className="input-field" 
                placeholder="admin" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>

            <div className="input-group" style={{ marginBottom: '2rem' }}>
              <label className="input-label">Security Key</label>
              <input 
                type="password" 
                className="input-field" 
                placeholder="••••••••" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
              Unlock Control Room
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ================= ADMIN DASHBOARD =================
  return (
    <div className="app-container">
      {/* Header */}
      <header className="header">
        <div className="header-container">
          <div className="logo-container">
            <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div className="logo-badge">A</div>
              <div className="logo-text">PROJECT <span className="logo-accent">AIRBORNE</span></div>
            </Link>
            <span style={{ 
              fontSize: '0.75rem', 
              backgroundColor: 'rgba(248, 90, 63, 0.1)', 
              color: 'var(--color-primary)', 
              border: '1px solid rgba(248, 90, 63, 0.2)',
              padding: '0.15rem 0.5rem',
              borderRadius: '4px',
              fontWeight: '600'
            }}>ADMIN</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button onClick={handleAdminLogout} className="btn btn-secondary btn-sm" style={{ padding: '0.4rem 0.75rem' }}>
              Lock Terminal
            </button>
          </div>
        </div>
      </header>

      <main className="main-content animate-fade-in" style={{ padding: '2rem 1.5rem' }}>
        {/* Navigation / Header info */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div>
            <Link to="/" style={{ 
              color: 'var(--color-text-secondary)', 
              textDecoration: 'none', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.25rem',
              fontSize: '0.85rem',
              marginBottom: '0.5rem'
            }}>
              <ArrowLeft size={12} /> Back to Main Page
            </Link>
            <h1 style={{ fontSize: '1.75rem', color: '#fff' }}>Arena Control Console</h1>
          </div>
        </div>

        {/* Tab Headers */}
        <div className="tabs-header">
          <button 
            className={`tab-btn ${activeTab === 'teams' ? 'active' : ''}`}
            onClick={() => setActiveTab('teams')}
          >
            <Users size={16} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> Teams
          </button>
          <button 
            className={`tab-btn ${activeTab === 'members' ? 'active' : ''}`}
            onClick={() => setActiveTab('members')}
          >
            <UserPlus size={16} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> Members
          </button>
          <button 
            className={`tab-btn ${activeTab === 'leads' ? 'active' : ''}`}
            onClick={() => setActiveTab('leads')}
          >
            <FileSpreadsheet size={16} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> Leads Import & Grid
          </button>
          <button 
            className={`tab-btn ${activeTab === 'manual' ? 'active' : ''}`}
            onClick={() => setActiveTab('manual')}
          >
            <Play size={16} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> Manual Scores
          </button>
          <button 
            className={`tab-btn ${activeTab === 'points' ? 'active' : ''}`}
            onClick={() => setActiveTab('points')}
          >
            <Settings size={16} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> Points System
          </button>
          <button 
            className={`tab-btn ${activeTab === 'approvals' ? 'active' : ''}`}
            onClick={() => setActiveTab('approvals')}
          >
            <CheckCircle size={16} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> 
            Pending Approvals
            {pendingLeads.length > 0 && (
              <span className="tab-badge">{pendingLeads.length}</span>
            )}
          </button>
        </div>

        {/* TAB CONTENTS */}

        {/* TAB 1: TEAMS */}
        {activeTab === 'teams' && (
          <section className="animate-fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', color: '#fff' }}>Registered Outreach Teams</h2>
              <button onClick={openAddTeamModal} className="btn btn-primary btn-sm">
                <PlusCircle size={16} /> Deploy New Team
              </button>
            </div>

            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Team Name</th>
                    <th>Type</th>
                    <th>Roster Count</th>
                    <th>Allocated Leads</th>
                    <th>Master Access Code</th>
                    <th style={{ textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {teams.map(team => {
                    const leadCount = leads.filter(l => l.allocatedTeam === team.id || l.allocatedTeam === team.name).length;
                    return (
                      <tr key={team.id}>
                        <td style={{ fontWeight: '600', color: 'white' }}>{team.name}</td>
                        <td><span className="badge badge-neutral">{team.type}</span></td>
                        <td>{team.members?.length || 0} members</td>
                        <td>{leadCount} leads</td>
                        <td><code>airborne2026</code></td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                            <button onClick={() => openEditTeamModal(team)} className="btn btn-secondary btn-sm" style={{ padding: '0.35rem 0.6rem' }}>
                              <Edit3 size={14} /> Edit
                            </button>
                            <button onClick={() => handleDeleteTeam(team.id, team.name)} className="btn btn-danger btn-sm" style={{ padding: '0.35rem 0.6rem' }}>
                              <Trash2 size={14} /> Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {teams.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', color: 'var(--color-text-secondary)', padding: '2rem' }}>
                        No teams are currently operational in the arena.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* TEAM FORM MODAL */}
            {showTeamModal && (
              <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                backgroundColor: 'rgba(0,0,0,0.8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 200,
                padding: '1rem'
              }}>
                <div className="card" style={{ width: '100%', maxWidth: '440px', position: 'relative' }}>
                  <button 
                    onClick={() => setShowTeamModal(false)}
                    style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', color: '#8e8e93', cursor: 'pointer' }}
                  >
                    <X size={20} />
                  </button>
                  
                  <h3 style={{ fontSize: '1.25rem', color: '#fff', marginBottom: '1.5rem' }}>
                    {teamModalMode === 'add' ? 'Deploy New Outreach Division' : 'Reprogram Team Details'}
                  </h3>

                  <form onSubmit={handleTeamSubmit}>
                    <div className="input-group">
                      <label className="input-label">Team Name</label>
                      <input 
                        type="text" 
                        className="input-field" 
                        placeholder="e.g. Team Titan" 
                        value={teamForm.name}
                        onChange={(e) => setTeamForm({...teamForm, name: e.target.value})}
                        required
                      />
                    </div>

                    <div className="input-group" style={{ marginBottom: '1.5rem' }}>
                      <label className="input-label">Outreach Type</label>
                      <select 
                        className="input-field"
                        value={teamForm.type}
                        onChange={(e) => setTeamForm({...teamForm, type: e.target.value})}
                      >
                        <option value="oGV">oGV</option>
                        <option value="oGTa">oGTa</option>
                        <option value="oGTe">oGTe</option>
                        <option value="Saegis oGV">Saegis oGV</option>
                        <option value="Saegis oGT">Saegis oGT</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>

                    <div style={{ 
                      backgroundColor: 'rgba(255,255,255,0.02)', 
                      border: '1px solid var(--color-border)', 
                      borderRadius: '8px', 
                      padding: '0.75rem', 
                      marginBottom: '1.5rem',
                      fontSize: '0.8rem',
                      color: 'var(--color-text-secondary)'
                    }}>
                      <strong>Master Access Password</strong>: <code>airborne2026</code> (This will be automatically pre-configured for logins).
                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                      <button type="button" onClick={() => setShowTeamModal(false)} className="btn btn-secondary">
                        Cancel
                      </button>
                      <button type="submit" className="btn btn-primary">
                        {teamModalMode === 'add' ? 'Deploy Team' : 'Save Changes'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </section>
        )}

        {/* TAB 2: MEMBERS */}
        {activeTab === 'members' && (
          <section className="animate-fade-in admin-grid">
            {/* Team Selector Panel */}
            <div className="card">
              <h3 style={{ fontSize: '1.1rem', color: '#fff', marginBottom: '1rem' }}>Active Divisions</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {teams.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTeamId(t.id)}
                    className={`btn ${selectedTeamId === t.id ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ justifyContent: 'flex-start', textAlign: 'left', width: '100%' }}
                  >
                    {t.name}
                  </button>
                ))}
                {teams.length === 0 && (
                  <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
                    No teams deployed yet.
                  </p>
                )}
              </div>
            </div>

            {/* Roster Panel */}
            <div className="card">
              {selectedTeamId ? (
                (() => {
                  const team = teams.find(t => t.id === selectedTeamId);
                  return (
                    <div>
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        borderBottom: '1px solid rgba(255,255,255,0.05)', 
                        paddingBottom: '0.75rem',
                        marginBottom: '1.5rem'
                      }}>
                        <h3 style={{ fontSize: '1.25rem', color: '#fff' }}>
                          Roster Board for <span style={{ color: 'var(--color-primary)' }}>{team?.name}</span>
                        </h3>
                        <span className="badge badge-neutral">{team?.type}</span>
                      </div>

                      {/* Add Member inline form */}
                      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
                        <input
                          type="text"
                          placeholder="Enter new agent name..."
                          className="input-field"
                          value={newMemberName}
                          onChange={(e) => setNewMemberName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleAddMember(); }}
                          style={{ margin: 0 }}
                        />
                        <button onClick={handleAddMember} className="btn btn-primary" style={{ whiteSpace: 'nowrap' }}>
                          <Plus size={16} /> Add Agent
                        </button>
                      </div>

                      {/* Roster Listing */}
                      <h4 style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)', marginBottom: '0.75rem', textTransform: 'uppercase' }}>
                        Enlisted Agents ({team?.members?.length || 0})
                      </h4>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {team?.members && team.members.length > 0 ? (
                          team.members.map((member, idx) => (
                            <div key={idx} style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              backgroundColor: 'rgba(255, 255, 255, 0.01)',
                              border: '1px solid var(--color-border)',
                              padding: '0.75rem 1rem',
                              borderRadius: '8px'
                            }}>
                              <span style={{ fontWeight: '500' }}>{member}</span>
                              <button 
                                onClick={() => handleDeleteMember(member)}
                                className="btn btn-danger btn-sm" 
                                style={{ padding: '0.25rem 0.5rem' }}
                              >
                                <Trash2 size={12} /> Discharge
                              </button>
                            </div>
                          ))
                        ) : (
                          <div style={{ textAlign: 'center', padding: '2rem', border: '1px dashed var(--color-border)', borderRadius: '8px', color: 'var(--color-text-secondary)' }}>
                             Roster is empty. Add agents to log outreach records.
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '200px', color: 'var(--color-text-secondary)' }}>
                  <HelpCircle size={40} style={{ marginBottom: '1rem', opacity: 0.5 }} />
                  Select an Outreach Division from the left pane to manage its active member roster.
                </div>
              )}
            </div>
          </section>
        )}

        {/* TAB 3: LEADS IMPORT & GRID */}
        {activeTab === 'leads' && (
          <section className="animate-fade-in">
            {/* 1. IMPORT UTILITIES CARD */}
            <div className="card" style={{ marginBottom: '2rem' }}>
              <h3 style={{ fontSize: '1.2rem', color: '#fff', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>
                Outreach Allocation Hub — Import Batch
              </h3>

              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                <button
                  onClick={() => { setImportSourceMode('paste'); setParsedPreviewLeads([]); }}
                  className={`btn btn-sm ${importSourceMode === 'paste' ? 'btn-primary' : 'btn-secondary'}`}
                >
                  Paste Excel Text (TSV)
                </button>
                <button
                  onClick={() => { setImportSourceMode('file'); setParsedPreviewLeads([]); }}
                  className={`btn btn-sm ${importSourceMode === 'file' ? 'btn-primary' : 'btn-secondary'}`}
                >
                  Upload Excel File (.xlsx)
                </button>
              </div>

              {/* Import options */}
              {importSourceMode === 'paste' ? (
                <div>
                  <div className="input-group">
                    <label className="input-label">Paste Spreadsheet Data (Columns: First Name, Last Name, Email, Contact Number)</label>
                    <textarea
                      className="input-field"
                      rows={4}
                      placeholder="John	Doe	john@example.com	+12345678&#10;Jane	Smith	jane@example.com	+98765432"
                      value={pastedData}
                      onChange={(e) => setPastedData(e.target.value)}
                      style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
                    />
                  </div>
                  <button onClick={parsePastedTSV} className="btn btn-secondary btn-sm" style={{ marginBottom: '1rem' }}>
                    Parse Columns
                  </button>
                </div>
              ) : (
                <div style={{
                  border: '2px dashed var(--color-border)',
                  borderRadius: '8px',
                  padding: '2rem',
                  textAlign: 'center',
                  marginBottom: '1rem',
                  position: 'relative'
                }}>
                  <Upload size={32} color="var(--color-primary)" style={{ marginBottom: '0.5rem' }} />
                  <p style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)', marginBottom: '0.75rem' }}>
                    Select or Drop a .xlsx spreadsheet. File must have columns: First Name, Last Name, Email, Contact Number
                  </p>
                  <input
                    type="file"
                    accept=".xlsx"
                    onChange={handleExcelFileUpload}
                    ref={(ref) => setFileInputRef(ref)}
                    style={{ 
                      opacity: 0, 
                      position: 'absolute', 
                      top: 0, 
                      left: 0, 
                      width: '100%', 
                      height: '100%', 
                      cursor: 'pointer' 
                    }}
                  />
                </div>
              )}

              {/* Import Preview and Commitment */}
              {parsedPreviewLeads.length > 0 && (
                <div style={{ marginTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1.5rem' }}>
                  <h4 style={{ color: '#fff', fontSize: '1rem', marginBottom: '1rem' }}>
                    Import Roster Preview ({parsedPreviewLeads.length} leads parsed)
                  </h4>

                  <div className="table-container" style={{ maxHeight: '200px', overflowY: 'auto', marginBottom: '1.5rem' }}>
                    <table className="custom-table" style={{ fontSize: '0.8rem' }}>
                      <thead>
                        <tr>
                          <th>First Name</th>
                          <th>Last Name</th>
                          <th>Email Address</th>
                          <th>Contact Number</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsedPreviewLeads.map((l, i) => (
                          <tr key={i}>
                            <td>{l.firstName}</td>
                            <td>{l.lastName}</td>
                            <td>{l.email}</td>
                            <td>{l.contactNumber}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div style={{ 
                    display: 'flex', 
                    flexWrap: 'wrap', 
                    alignItems: 'center', 
                    gap: '1rem', 
                    backgroundColor: 'rgba(248, 90, 63, 0.03)', 
                    border: '1px solid rgba(248, 90, 63, 0.1)', 
                    padding: '1rem', 
                    borderRadius: '8px' 
                  }}>
                    <div style={{ flex: 1, minWidth: '220px' }}>
                      <label className="input-label" style={{ marginBottom: '0.25rem' }}>Allocate This Batch To:</label>
                      <select
                        className="input-field"
                        value={allocateImportTeamId}
                        onChange={(e) => setAllocateImportTeamId(e.target.value)}
                        style={{ margin: 0, fontSize: '0.85rem' }}
                      >
                        <option value="">-- Keep Unassigned (Assign Later) --</option>
                        {teams.map(t => (
                          <option key={t.id} value={t.id}>{t.name} ({t.type})</option>
                        ))}
                      </select>
                    </div>
                    <button 
                      onClick={handleCommitLeadsImport}
                      className="btn btn-primary"
                      style={{ height: '38px', marginTop: '1.25rem', whiteSpace: 'nowrap' }}
                    >
                      Commit and Allocate Batch
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 2. LEADS SEARCH / FILTER / GRID */}
            <div className="card">
              <h3 style={{ fontSize: '1.2rem', color: '#fff', marginBottom: '1.25rem' }}>
                All Database Entries
              </h3>

              {/* Filters */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '1rem',
                marginBottom: '1.5rem'
              }}>
                <div className="input-group" style={{ margin: 0 }}>
                  <label className="input-label">Filter by Team</label>
                  <select 
                    className="input-field" 
                    value={filterTeamId}
                    onChange={(e) => setFilterTeamId(e.target.value)}
                    style={{ margin: 0 }}
                  >
                    <option value="">-- All Teams --</option>
                    <option value="unassigned">-- Unassigned Leads --</option>
                    {teams.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>

                <div className="input-group" style={{ margin: 0 }}>
                  <label className="input-label">Filter by Status</label>
                  <select 
                    className="input-field" 
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    style={{ margin: 0 }}
                  >
                    <option value="">-- All Statuses --</option>
                    <option value="—">— (not yet called)</option>
                    <option value="Cold Call Taken">Cold Call Taken</option>
                    <option value="No Answer (Call 1)">No Answer (Call 1)</option>
                    <option value="No Answer (Call 2)">No Answer (Call 2)</option>
                    <option value="Invalid Number">Invalid Number</option>
                    <option value="Projects Sent">Projects Sent</option>
                    <option value="Signed Up">Signed Up</option>
                    <option value="Rejected">Rejected</option>
                    <option value="Applied">Applied</option>
                    <option value="Approved">Approved</option>
                  </select>
                </div>
              </div>

              {/* Grid table */}
              <div className="table-container">
                <table className="custom-table" style={{ fontSize: '0.85rem' }}>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email / Contact</th>
                      <th>Allocated Team</th>
                      <th>Outreach Status</th>
                      <th>Remarks</th>
                      <th>Admin Approved</th>
                      <th style={{ textAlign: 'center' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMainLeads.map((lead) => {
                      const leadTeam = teams.find(t => t.id === lead.allocatedTeam || t.name === lead.allocatedTeam);
                      return (
                        <tr key={lead.id}>
                          <td style={{ fontWeight: '600', color: 'white' }}>
                            {lead.firstName} {lead.lastName}
                          </td>
                          <td>
                            <div>{lead.email || '—'}</div>
                            <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.75rem' }}>{lead.contactNumber || '—'}</div>
                          </td>
                          <td>
                            <select
                              className="input-field"
                              value={lead.allocatedTeam || ''}
                              onChange={(e) => handleLeadReallocation(lead.id, e.target.value)}
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', width: '100%', margin: 0 }}
                            >
                              <option value="">-- Unassigned --</option>
                              {teams.map(t => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <span className="badge badge-neutral" style={{ fontSize: '0.75rem' }}>
                              {lead.status || '—'}
                            </span>
                            {lead.approachedBy && (
                              <div style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)', marginTop: '0.2rem' }}>
                                By: {lead.approachedBy}
                              </div>
                            )}
                          </td>
                          <td style={{ maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {lead.remarks || '—'}
                          </td>
                          <td>
                            {lead.status === 'Applied' || lead.status === 'Approved' ? (
                              lead.adminApproved ? (
                                <span className="badge badge-success">APPROVED</span>
                              ) : (
                                <span className="badge badge-warning">PENDING</span>
                              )
                            ) : (
                              <span style={{ color: 'var(--color-text-secondary)' }}>N/A</span>
                            )}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              onClick={() => handleDeleteLead(lead.id, `${lead.firstName} ${lead.lastName}`)}
                              className="btn btn-danger btn-sm"
                              style={{ padding: '0.3rem' }}
                            >
                              <Trash2 size={12} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredMainLeads.length === 0 && (
                      <tr>
                        <td colSpan={7} style={{ textAlign: 'center', color: 'var(--color-text-secondary)', padding: '2rem' }}>
                          No matching database entries found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {/* TAB 4: MANUAL SCORES */}
        {activeTab === 'manual' && (
          <section className="animate-fade-in">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', color: '#fff' }}>Manual Score Adjuster</h2>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
                Use this dashboard to log activities not automatically captured in the CR outreach tracker. Changes are auto-saved.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {teams.map(team => {
                const scores = manualScores[team.id] || {
                  virtualMeetings: 0,
                  ogxSignUps: 0,
                  digitalCampaigns: 0,
                  physicalCampaigns: 0,
                  physicalAttendance: 0,
                  innovationsScore: 0
                };

                const pointTotal = calculatePointsPreview(team.id);

                return (
                  <div key={team.id} className="card" style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr',
                    gap: '1.5rem',
                    borderLeft: '4px solid var(--color-primary)'
                  }}>
                    {/* Title and total calculation */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>
                      <h3 style={{ fontSize: '1.15rem', color: '#fff', fontWeight: '600' }}>{team.name}</h3>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginRight: '0.5rem' }}>MANUAL METRICS SUM:</span>
                        <span style={{ fontFamily: 'Space Grotesk', fontSize: '1.25rem', fontWeight: '700', color: 'var(--color-primary)' }}>
                          {pointTotal} <span style={{ fontSize: '0.85rem', fontWeight: '400', color: '#fff' }}>pts</span>
                        </span>
                      </div>
                    </div>

                    {/* Matrix inputs */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                      gap: '1rem'
                    }}>
                      <div className="input-group" style={{ margin: 0 }}>
                        <label className="input-label" style={{ fontSize: '0.75rem' }}>Virtual Meetings (x{pointsConfig.virtualMeetings})</label>
                        <input
                          type="number"
                          className="input-field"
                          value={scores.virtualMeetings || 0}
                          onChange={(e) => handleManualScoreChange(team.id, 'virtualMeetings', e.target.value)}
                        />
                      </div>

                      <div className="input-group" style={{ margin: 0 }}>
                        <label className="input-label" style={{ fontSize: '0.75rem' }}>oGX Sign Ups (x{pointsConfig.ogxSignUps})</label>
                        <input
                          type="number"
                          className="input-field"
                          value={scores.ogxSignUps || 0}
                          onChange={(e) => handleManualScoreChange(team.id, 'ogxSignUps', e.target.value)}
                        />
                      </div>

                      <div className="input-group" style={{ margin: 0 }}>
                        <label className="input-label" style={{ fontSize: '0.75rem' }}>Digital Campaigns (x{pointsConfig.digitalCampaigns})</label>
                        <input
                          type="number"
                          className="input-field"
                          value={scores.digitalCampaigns || 0}
                          onChange={(e) => handleManualScoreChange(team.id, 'digitalCampaigns', e.target.value)}
                        />
                      </div>

                      <div className="input-group" style={{ margin: 0 }}>
                        <label className="input-label" style={{ fontSize: '0.75rem' }}>Physical Campaigns (x{pointsConfig.physicalCampaigns})</label>
                        <input
                          type="number"
                          className="input-field"
                          value={scores.physicalCampaigns || 0}
                          onChange={(e) => handleManualScoreChange(team.id, 'physicalCampaigns', e.target.value)}
                        />
                      </div>

                      <div className="input-group" style={{ margin: 0 }}>
                        <label className="input-label" style={{ fontSize: '0.75rem' }}>Attendance (x{pointsConfig.physicalAttendance})</label>
                        <input
                          type="number"
                          className="input-field"
                          value={scores.physicalAttendance || 0}
                          onChange={(e) => handleManualScoreChange(team.id, 'physicalAttendance', e.target.value)}
                        />
                      </div>

                      <div className="input-group" style={{ margin: 0 }}>
                        <label className="input-label" style={{ fontSize: '0.75rem', color: '#ff7d66' }}>Innovations Score (Direct)</label>
                        <input
                          type="number"
                          className="input-field"
                          max={100}
                          value={scores.innovationsScore || 0}
                          onChange={(e) => handleManualScoreChange(team.id, 'innovationsScore', e.target.value)}
                          style={{ borderColor: 'rgba(255, 125, 102, 0.3)' }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
              {teams.length === 0 && (
                <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-secondary)' }}>
                  No active teams to adjust scores for.
                </div>
              )}
            </div>
          </section>
        )}

        {/* TAB 5: POINTS SYSTEM */}
        {activeTab === 'points' && (
          <section className="animate-fade-in" style={{ maxWidth: '600px', margin: '0 auto' }}>
            <div className="card">
              <h3 style={{ fontSize: '1.2rem', color: '#fff', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>
                <Award color="var(--color-primary)" /> Score Multiplier Settings
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: '1rem' }}>
                  <div>
                    <strong style={{ display: 'block', fontSize: '0.95rem' }}>Approved outreach leads</strong>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Score points earned when a lead signs up and gets verified. Default: 200</span>
                  </div>
                  <input
                    type="number"
                    className="input-field"
                    style={{ width: '80px', margin: 0 }}
                    value={pointsConfig.approval}
                    onChange={(e) => handlePointsChange('approval', e.target.value)}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: '1rem' }}>
                  <div>
                    <strong style={{ display: 'block', fontSize: '0.95rem' }}>Applied outreach leads</strong>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Score points earned when a lead files an application. Default: 75</span>
                  </div>
                  <input
                    type="number"
                    className="input-field"
                    style={{ width: '80px', margin: 0 }}
                    value={pointsConfig.application}
                    onChange={(e) => handlePointsChange('application', e.target.value)}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: '1rem' }}>
                  <div>
                    <strong style={{ display: 'block', fontSize: '0.95rem' }}>Virtual Meetings with Leads</strong>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Score weight per online session logged. Default: 5</span>
                  </div>
                  <input
                    type="number"
                    className="input-field"
                    style={{ width: '80px', margin: 0 }}
                    value={pointsConfig.virtualMeetings}
                    onChange={(e) => handlePointsChange('virtualMeetings', e.target.value)}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: '1rem' }}>
                  <div>
                    <strong style={{ display: 'block', fontSize: '0.95rem' }}>oGX Sign Ups</strong>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Score weight per registered sign up. Default: 1</span>
                  </div>
                  <input
                    type="number"
                    className="input-field"
                    style={{ width: '80px', margin: 0 }}
                    value={pointsConfig.ogxSignUps}
                    onChange={(e) => handlePointsChange('ogxSignUps', e.target.value)}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: '1rem' }}>
                  <div>
                    <strong style={{ display: 'block', fontSize: '0.95rem' }}>Internal Digital Campaigns</strong>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Score weight per published digital campaign. Default: 5</span>
                  </div>
                  <input
                    type="number"
                    className="input-field"
                    style={{ width: '80px', margin: 0 }}
                    value={pointsConfig.digitalCampaigns}
                    onChange={(e) => handlePointsChange('digitalCampaigns', e.target.value)}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: '1rem' }}>
                  <div>
                    <strong style={{ display: 'block', fontSize: '0.95rem' }}>Physical Campaigns</strong>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Score weight per qualified physical drive (min 20 SUs). Default: 20</span>
                  </div>
                  <input
                    type="number"
                    className="input-field"
                    style={{ width: '80px', margin: 0 }}
                    value={pointsConfig.physicalCampaigns}
                    onChange={(e) => handlePointsChange('physicalCampaigns', e.target.value)}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: '1rem' }}>
                  <div>
                    <strong style={{ display: 'block', fontSize: '0.95rem' }}>Physical Workspace Attendance</strong>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Score weight per logged workspace day. Default: 5</span>
                  </div>
                  <input
                    type="number"
                    className="input-field"
                    style={{ width: '80px', margin: 0 }}
                    value={pointsConfig.physicalAttendance}
                    onChange={(e) => handlePointsChange('physicalAttendance', e.target.value)}
                  />
                </div>

                <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '1.25rem', marginTop: '0.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                  <button onClick={savePointsConfig} className="btn btn-primary">
                    Apply Point Configuration
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* TAB 6: PENDING APPROVALS */}
        {activeTab === 'approvals' && (
          <section className="animate-fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <h2 style={{ fontSize: '1.25rem', color: '#fff' }}>Conversion Review Deck</h2>
                <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
                  Verify leads marked as "Applied" or "Approved" by team agents to allocate points.
                </p>
              </div>
              
              {pendingLeads.length > 0 && (
                <button onClick={handleBulkApprove} className="btn btn-primary btn-sm">
                  <CheckCircle size={16} /> Bulk Approve All ({pendingLeads.length})
                </button>
              )}
            </div>

            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Lead Name</th>
                    <th>Outreach Division</th>
                    <th>Submitting Agent</th>
                    <th>Requested Status</th>
                    <th>Agent Remarks</th>
                    <th style={{ textAlign: 'center' }}>Verdict Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingLeads.map(lead => {
                    const leadTeam = teams.find(t => t.id === lead.allocatedTeam || t.name === lead.allocatedTeam);
                    return (
                      <tr key={lead.id}>
                        <td style={{ fontWeight: '600', color: 'white' }}>
                          {lead.firstName} {lead.lastName}
                        </td>
                        <td>{leadTeam?.name || 'Unallocated'}</td>
                        <td style={{ fontWeight: '500' }}>{lead.approachedBy || 'N/A'}</td>
                        <td>
                          <span className={`badge ${lead.status === 'Approved' ? 'badge-success' : 'badge-warning'}`}>
                            {lead.status}
                          </span>
                        </td>
                        <td>{lead.remarks || '—'}</td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                            <button 
                              onClick={() => handleApproveLead(lead.id)}
                              className="btn btn-primary btn-sm"
                              style={{ 
                                padding: '0.35rem 0.6rem', 
                                backgroundColor: 'rgba(16, 185, 129, 0.15)', 
                                color: '#10b981', 
                                border: '1px solid rgba(16, 185, 129, 0.3)' 
                              }}
                            >
                              <Check size={14} style={{ marginRight: '2px' }} /> Approve
                            </button>
                            <button 
                              onClick={() => handleRejectLead(lead.id)}
                              className="btn btn-danger btn-sm"
                              style={{ padding: '0.35rem 0.6rem' }}
                            >
                              <X size={14} style={{ marginRight: '2px' }} /> Reject & Revert
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {pendingLeads.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', color: 'var(--color-text-secondary)', padding: '3rem' }}>
                        🏆 Outstanding! All conversion logs have been verified and processed.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>

      <footer style={{
        marginTop: 'auto',
        borderTop: '1px solid var(--color-border)',
        padding: '1.5rem 2rem',
        textAlign: 'center',
        color: 'var(--color-text-secondary)',
        fontSize: '0.85rem'
      }}>
        Project Airborne &copy; 2026. Central Commander deck.
      </footer>
    </div>
  );
}
