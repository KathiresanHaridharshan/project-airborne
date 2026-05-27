import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { db } from '../firebase';
import { collection, onSnapshot, doc, updateDoc, query, where } from 'firebase/firestore';
import { LogOut, ArrowLeft, Search, Save, AlertTriangle, CheckCircle, Bell, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

export default function CRTracker() {
  const navigate = useNavigate();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [password, setPassword] = useState('');
  
  // App states
  const [teams, setTeams] = useState([]);
  const [currentTeam, setCurrentTeam] = useState(null);
  const [leads, setLeads] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [savingRowId, setSavingRowId] = useState(null);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Check sessionStorage on load
  useEffect(() => {
    const storedTeamId = sessionStorage.getItem('airborne_team_id');
    const storedTeamName = sessionStorage.getItem('airborne_team_name');
    if (storedTeamId && storedTeamName) {
      setIsLoggedIn(true);
      setSelectedTeamId(storedTeamId);
    }
  }, []);

  // Fetch Teams
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'teams'), (snapshot) => {
      const teamsList = [];
      snapshot.forEach((doc) => {
        teamsList.push({ id: doc.id, ...doc.data() });
      });
      setTeams(teamsList);
    });
    return unsub;
  }, []);

  // Set Current Team details
  useEffect(() => {
    if (isLoggedIn && selectedTeamId && teams.length > 0) {
      const team = teams.find(t => t.id === selectedTeamId);
      if (team) {
        setCurrentTeam(team);
      }
    }
  }, [isLoggedIn, selectedTeamId, teams]);

  // Fetch Leads allocated only to current team
  useEffect(() => {
    if (isLoggedIn && selectedTeamId) {
      // Query leads where allocatedTeam == team.id OR allocatedTeam == team.name
      const unsub = onSnapshot(collection(db, 'leads'), (snapshot) => {
        const leadsList = [];
        snapshot.forEach((d) => {
          const data = d.data();
          if (data.allocatedTeam === selectedTeamId || (currentTeam && data.allocatedTeam === currentTeam.name)) {
            leadsList.push({ id: d.id, ...data });
          }
        });
        
        // Sort leads by name or date
        const sortedLeads = leadsList.sort((a, b) => {
          const nameA = `${a.firstName || ''} ${a.lastName || ''}`.trim();
          const nameB = `${b.firstName || ''} ${b.lastName || ''}`.trim();
          return nameA.localeCompare(nameB);
        });
        
        setLeads(sortedLeads);
      });
      return unsub;
    }
  }, [isLoggedIn, selectedTeamId, currentTeam]);

  // Login handler
  const handleLogin = (e) => {
    e.preventDefault();
    if (!selectedTeamId) {
      toast.error("Please select a team");
      return;
    }
    if (password !== "airborne2026") {
      toast.error("Invalid password");
      return;
    }

    const team = teams.find(t => t.id === selectedTeamId);
    if (team) {
      sessionStorage.setItem('airborne_team_id', team.id);
      sessionStorage.setItem('airborne_team_name', team.name);
      setIsLoggedIn(true);
      setCurrentTeam(team);
      toast.success(`Logged in as ${team.name}`);
    }
  };

  // Logout handler
  const handleLogout = () => {
    sessionStorage.removeItem('airborne_team_id');
    sessionStorage.removeItem('airborne_team_name');
    setIsLoggedIn(false);
    setCurrentTeam(null);
    setLeads([]);
    toast.success("Logged out successfully");
  };

  // Local state updater for individual lead inputs (so inputs remain fast without waiting for Firestore saves)
  const handleLeadChange = (leadId, field, value) => {
    setLeads(prevLeads =>
      prevLeads.map(l => {
        if (l.id === leadId) {
          // If status changes to 'Applied' or 'Approved', reset approval flags
          if (field === 'status') {
            const isApprovalStatus = value === 'Applied' || value === 'Approved';
            return { 
              ...l, 
              [field]: value, 
              adminApproved: false,
              adminRejected: false // Reset rejection notice on edit
            };
          }
          return { ...l, [field]: value };
        }
        return l;
      })
    );
  };

  // Save changes to Firestore per row
  const saveLeadChanges = async (lead) => {
    setSavingRowId(lead.id);
    try {
      const leadRef = doc(db, 'leads', lead.id);
      await updateDoc(leadRef, {
        approachedBy: lead.approachedBy || '',
        status: lead.status || '—',
        remarks: lead.remarks || '',
        adminApproved: lead.adminApproved || false,
        adminRejected: lead.adminRejected || false,
        updatedAt: new Date()
      });
      toast.success(`Changes saved for ${lead.firstName} ${lead.lastName}`);
    } catch (error) {
      console.error("Error saving lead:", error);
      toast.error("Failed to save changes");
    } finally {
      setSavingRowId(null);
    }
  };

  // Dismiss rejection alert banner
  const dismissRejection = async (lead) => {
    try {
      const leadRef = doc(db, 'leads', lead.id);
      await updateDoc(leadRef, {
        adminRejected: false
      });
    } catch (e) {
      console.error(e);
    }
  };

  // Filter leads based on search query
  const filteredLeads = leads.filter(lead => {
    const fullName = `${lead.firstName || ''} ${lead.lastName || ''}`.toLowerCase();
    const email = (lead.email || '').toLowerCase();
    const contact = (lead.contactNumber || '').toLowerCase();
    const query = searchQuery.toLowerCase();
    return fullName.includes(query) || email.includes(query) || contact.includes(query);
  });

  // Pagination calculations
  const totalPages = Math.ceil(filteredLeads.length / itemsPerPage);
  const paginatedLeads = filteredLeads.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Helper to determine status dropdown values
  const getStatusOptions = (teamType) => {
    const type = (teamType || '').toLowerCase();
    const standardOptions = [
      { value: '—', label: '— (not yet called)' },
      { value: 'Cold Call Taken', label: 'Cold Call Taken' },
      { value: 'No Answer (Call 1)', label: 'No Answer (Call 1)' },
      { value: 'No Answer (Call 2)', label: 'No Answer (Call 2)' },
      { value: 'Invalid Number', label: 'Invalid Number' }
    ];

    // oGV specific dropdown options
    if (type.includes('ogv')) {
      standardOptions.push({ value: 'Projects Sent', label: 'Projects Sent (oGV)' });
    }
    
    // oGT specific dropdown options
    if (type.includes('ogt')) {
      standardOptions.push({ value: 'Signed Up', label: 'Signed Up (oGT)' });
    }

    // End options
    standardOptions.push(
      { value: 'Rejected', label: 'Rejected' },
      { value: 'Applied', label: 'Applied' },
      { value: 'Approved', label: 'Approved' }
    );

    return standardOptions;
  };

  // ================= LOGIN SCREEN =================
  if (!isLoggedIn) {
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
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>CR TRACKER LOG IN</p>
          </div>

          <form onSubmit={handleLogin}>
            <div className="input-group">
              <label className="input-label">Select Your Team</label>
              <select 
                className="input-field" 
                value={selectedTeamId} 
                onChange={(e) => setSelectedTeamId(e.target.value)}
                style={{ appearance: 'none', cursor: 'pointer' }}
              >
                <option value="">-- Choose Team --</option>
                {teams.map(t => (
                  <option key={t.id} value={t.id}>{t.name} ({t.type})</option>
                ))}
              </select>
            </div>

            <div className="input-group" style={{ marginBottom: '2rem' }}>
              <label className="input-label">Master Password</label>
              <input 
                type="password" 
                className="input-field" 
                placeholder="••••••••" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
              Access Outreach Ledger
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ================= TRACKER VIEW =================
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
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ fontSize: '0.9rem', color: '#fff', fontWeight: '500' }}>
              Welcome, <span style={{ color: 'var(--color-primary)' }}>{currentTeam?.name || 'Loading Team...'}</span>
            </span>
            <button onClick={handleLogout} className="btn btn-secondary btn-sm" style={{ padding: '0.4rem 0.75rem' }}>
              <LogOut size={14} /> Log Out
            </button>
          </div>
        </div>
      </header>

      <main className="main-content animate-fade-in" style={{ padding: '2rem 1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
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
            <h1 style={{ fontSize: '1.75rem', color: '#fff' }}>Outreach Allocation Ledger</h1>
          </div>
          <span className="badge badge-neutral" style={{ padding: '0.4rem 0.8rem' }}>
            Team Type: {currentTeam?.type}
          </span>
        </div>

        {/* Rejection Notification Banner */}
        {leads.some(l => l.adminRejected) && (
          <div style={{ 
            backgroundColor: 'rgba(239, 68, 68, 0.1)', 
            border: '1px solid rgba(239, 68, 68, 0.25)', 
            borderRadius: '8px', 
            padding: '1rem', 
            marginBottom: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#ef4444', fontWeight: '600' }}>
              <Bell size={18} /> Outreach Ledger Alerts
            </div>
            <div style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>
              The admin has rejected one or more of your submissions. Those leads have been reverted to "Cold Call Taken" for revisions.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.5rem' }}>
              {leads.filter(l => l.adminRejected).map(lead => (
                <div key={lead.id} style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  backgroundColor: 'rgba(0,0,0,0.2)', 
                  padding: '0.4rem 0.75rem', 
                  borderRadius: '6px',
                  fontSize: '0.85rem'
                }}>
                  <span><strong>{lead.firstName} {lead.lastName}</strong>: "{lead.remarks || 'No remarks provided'}"</span>
                  <button 
                    onClick={() => dismissRejection(lead)}
                    className="btn btn-secondary btn-sm" 
                    style={{ padding: '0.1rem 0.5rem', fontSize: '0.75rem' }}
                  >
                    Acknowledge
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filter bar */}
        <div style={{
          display: 'flex',
          backgroundColor: 'var(--color-bg-card)',
          border: '1px solid var(--color-border)',
          borderRadius: '12px',
          padding: '0.75rem 1rem',
          alignItems: 'center',
          gap: '0.75rem',
          marginBottom: '1.5rem'
        }}>
          <Search size={18} color="var(--color-text-secondary)" />
          <input 
            type="text" 
            placeholder="Search leads by name, email, or number..." 
            className="input-field"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            style={{ border: 'none', background: 'none', padding: 0 }}
          />
        </div>

        {/* Lead Spreadsheet Grid */}
        <div className="table-container">
          <table className="custom-table" style={{ minWidth: '950px' }}>
            <thead>
              <tr>
                <th style={{ width: '180px' }}>Lead Name</th>
                <th style={{ width: '180px' }}>Contact Details</th>
                <th style={{ width: '180px' }}>Approached By</th>
                <th style={{ width: '180px' }}>Outreach Status</th>
                <th>Remarks / Notes</th>
                <th style={{ width: '100px', textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {paginatedLeads.length > 0 ? (
                paginatedLeads.map((lead) => {
                  const statusOptions = getStatusOptions(currentTeam?.type);
                  const isPending = (lead.status === 'Applied' || lead.status === 'Approved') && !lead.adminApproved;
                  const isApproved = (lead.status === 'Applied' || lead.status === 'Approved') && lead.adminApproved;

                  return (
                    <tr key={lead.id}>
                      <td style={{ verticalAlign: 'top', padding: '1rem 1.25rem' }}>
                        <div style={{ fontWeight: '600', color: 'white' }}>
                          {lead.firstName} {lead.lastName}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '0.2rem' }}>
                          Allocated: {new Date(lead.createdAt?.seconds * 1000 || Date.now()).toLocaleDateString()}
                        </div>
                      </td>
                      
                      <td style={{ verticalAlign: 'top', fontSize: '0.85rem' }}>
                        <div>{lead.email || '—'}</div>
                        <div style={{ color: 'var(--color-text-secondary)', marginTop: '0.25rem' }}>
                          {lead.contactNumber || '—'}
                        </div>
                      </td>

                      <td style={{ verticalAlign: 'top' }}>
                        <select
                          className="input-field"
                          value={lead.approachedBy || ''}
                          onChange={(e) => handleLeadChange(lead.id, 'approachedBy', e.target.value)}
                          style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem', width: '100%' }}
                        >
                          <option value="">-- Assigned Member --</option>
                          {currentTeam?.members?.map((m, idx) => (
                            <option key={idx} value={m}>{m}</option>
                          ))}
                        </select>
                      </td>

                      <td style={{ verticalAlign: 'top' }}>
                        <select
                          className="input-field"
                          value={lead.status || '—'}
                          onChange={(e) => handleLeadChange(lead.id, 'status', e.target.value)}
                          style={{ 
                            padding: '0.5rem 0.75rem', 
                            fontSize: '0.85rem', 
                            width: '100%',
                            borderColor: isPending ? 'var(--color-warning)' : isApproved ? 'var(--color-success)' : 'var(--color-border)',
                            color: isPending ? '#f59e0b' : isApproved ? '#10b981' : 'var(--color-text-primary)'
                          }}
                        >
                          {statusOptions.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                        
                        {/* Approval Badges */}
                        {isPending && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#f59e0b', fontSize: '0.7rem', fontWeight: '600', marginTop: '0.4rem' }}>
                            <AlertTriangle size={10} /> PENDING ADMIN APPROVAL
                          </div>
                        )}
                        {isApproved && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#10b981', fontSize: '0.7rem', fontWeight: '600', marginTop: '0.4rem' }}>
                            <CheckCircle size={10} /> ADMIN APPROVED
                          </div>
                        )}
                        {lead.adminRejected && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#ef4444', fontSize: '0.7rem', fontWeight: '600', marginTop: '0.4rem' }}>
                            <AlertTriangle size={10} /> ADMIN REJECTED
                          </div>
                        )}
                      </td>

                      <td style={{ verticalAlign: 'top' }}>
                        <textarea
                          className="input-field"
                          placeholder="Add call notes, conversation summary, next steps..."
                          value={lead.remarks || ''}
                          onChange={(e) => handleLeadChange(lead.id, 'remarks', e.target.value)}
                          rows={1}
                          style={{ 
                            padding: '0.5rem 0.75rem', 
                            fontSize: '0.85rem', 
                            width: '100%', 
                            resize: 'vertical',
                            minHeight: '38px',
                            fontFamily: 'inherit'
                          }}
                        />
                      </td>

                      <td style={{ verticalAlign: 'top', textAlign: 'center' }}>
                        <button
                          onClick={() => saveLeadChanges(lead)}
                          disabled={savingRowId === lead.id}
                          className="btn btn-primary"
                          style={{ 
                            padding: '0.5rem 0.8rem', 
                            width: '100%', 
                            height: '38px', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            opacity: savingRowId === lead.id ? 0.7 : 1
                          }}
                        >
                          {savingRowId === lead.id ? (
                            <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />
                          ) : (
                            <>
                              <Save size={14} /> Save
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', color: 'var(--color-text-secondary)', padding: '3rem' }}>
                    No leads allocated to your team or matching the search filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            marginTop: '1.5rem',
            padding: '0 0.5rem'
          }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
              Showing {Math.min(filteredLeads.length, (currentPage - 1) * itemsPerPage + 1)} to {Math.min(filteredLeads.length, currentPage * itemsPerPage)} of {filteredLeads.length} leads
            </div>
            
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button 
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="btn btn-secondary btn-sm"
              >
                Previous
              </button>
              
              {Array.from({ length: totalPages }).map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentPage(idx + 1)}
                  className={`btn btn-sm ${currentPage === idx + 1 ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ width: '32px', padding: 0 }}
                >
                  {idx + 1}
                </button>
              ))}

              <button 
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="btn btn-secondary btn-sm"
              >
                Next
              </button>
            </div>
          </div>
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
        Project Airborne &copy; 2026. Data locked under Master Vault rules.
      </footer>
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}} />
    </div>
  );
}
