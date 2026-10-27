import "./staffDashboard.css";
import "./requesterDashboard.css";
import { useEffect, useState, type CSSProperties } from "react";
import { Link, useNavigate } from "react-router-dom";
import { fetchRequesterDashboard, RequesterDashboardData, RequesterApiError } from "../api.js";
import { useAuth } from "../context/AuthContext.js";
import { zenGreen } from "../theme.js";
const formatTime=(value:string)=>new Date(value).toLocaleString("en-GB",{timeZone:"Asia/Bangkok"});
const statusLabel=(value:string)=>value==="WAITING_FOR_REQUESTER"?"Waiting for Requester":value.toLowerCase().split("_").map(word=>word[0].toUpperCase()+word.slice(1)).join(" ");
export default function RequesterDashboard(){
  const [data,setData]=useState<RequesterDashboardData>(),[loading,setLoading]=useState(true),[error,setError]=useState(false),[forbidden,setForbidden]=useState(false),[revision,setRevision]=useState(0);
  const {refreshUser}=useAuth(),navigate=useNavigate();
  useEffect(()=>{
    let cancelled=false;setData(undefined);setLoading(true);setError(false);setForbidden(false);
    void fetchRequesterDashboard().then(result=>{if(!cancelled)setData(result);}).catch(async failure=>{
      if(cancelled)return;
      if(failure instanceof RequesterApiError&&(failure.status===401||failure.code==="PASSWORD_CHANGE_REQUIRED")){
        await refreshUser();if(!cancelled)navigate(failure.status===401?"/login":"/change-password",{replace:true});
      }else if(failure instanceof RequesterApiError&&failure.status===403)setForbidden(true);
      else setError(true);
    }).finally(()=>{if(!cancelled)setLoading(false);});
    return()=>{cancelled=true;};
  },[revision]);
  const cards=[{key:"openTickets",label:"Open Tickets",note:"Your active support requests"},{key:"waitingForRequester",label:"Waiting for Me",note:"Tickets awaiting your response"}] as const;
  return <div className="staff-dashboard requester-dashboard container py-4" style={{"--dashboard-green":zenGreen.primary,"--dashboard-secondary":zenGreen.secondary,"--dashboard-pale":zenGreen.pale,"--dashboard-muted":zenGreen.readOnlyBg,color:zenGreen.text} as CSSProperties}>
    <header className="dashboard-header"><div><p className="dashboard-eyebrow">YOUR SUPPORT OVERVIEW</p><h1>My Dashboard</h1><p className="dashboard-subtitle">Keep track of your requests and see what needs your attention.</p></div><button className="btn dashboard-refresh" disabled={loading} onClick={()=>setRevision(value=>value+1)}>Refresh Dashboard</button></header>
    <div className="dashboard-toolbar"><nav aria-label="Dashboard quick actions"><Link to="/tickets">My Tickets <span aria-hidden="true">↗</span></Link><Link to="/tickets/new">Create Ticket <span aria-hidden="true">↗</span></Link></nav>{data&&<p role="status" className="dashboard-updated">Last updated: <time dateTime={data.asOf}>{formatTime(data.asOf)}</time> (Asia/Bangkok)</p>}</div>
    {loading&&<p role="status" className="dashboard-feedback">Loading dashboard…</p>}
    {forbidden&&<p role="alert" className="dashboard-feedback">You do not have permission to view this dashboard.</p>}
    {error&&<div role="alert" className="dashboard-feedback">Could not load your dashboard. <button className="btn btn-outline-success btn-sm" onClick={()=>setRevision(value=>value+1)}>Retry Dashboard</button></div>}
    {data&&<><div className="dashboard-kpis">{cards.map(({key,label,note},index)=><Link className="dashboard-kpi" to={data.drillDown[key]} key={key} aria-label={`${label}: ${data.metrics[key]}`}><div className="dashboard-kpi-top"><span className="dashboard-kpi-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true" focusable="false">{index===0?<><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></>:<><circle cx="12" cy="12" r="9"/><path d="M12 7v6m0 3v1"/></>}</svg></span><span className="dashboard-kpi-arrow" aria-hidden="true">↗</span></div><strong>{data.metrics[key]}</strong><span className="dashboard-kpi-label">{label}</span><span className="requester-kpi-note">{note}</span></Link>)}</div>
    <div className="requester-recent-grid">{([{key:"recentlyUpdated",title:"Recently Updated"},{key:"recentlyResolved",title:"Recently Resolved"}] as const).map(({key,title})=><section key={key} className="dashboard-panel dashboard-recent" aria-labelledby={`requester-${key}`}><div className="dashboard-panel-heading"><div><h2 id={`requester-${key}`}>{title}</h2><p>{key==="recentlyResolved"?"Currently resolved · updated in the last 7 days":"Updated in the last 7 days"} · up to 5 Tickets</p></div></div>{!data[key].length?<div className="requester-empty"><span className="requester-empty-icon" aria-hidden="true">{key==="recentlyResolved"?"✓":"↻"}</span><h3>{key==="recentlyResolved"?"No recently resolved tickets":"No recently updated tickets"}</h3><p>{key==="recentlyResolved"?"Your currently resolved tickets updated within the last 7 days will appear here.":"Your tickets updated within the last 7 days will appear here. Older requests are still available in My Tickets."}</p><Link to="/tickets">View My Tickets <span aria-hidden="true">→</span></Link></div>:<ul className="dashboard-recent-list">{data[key].map(ticket=><li key={ticket.id}><Link to={ticket.href} className="dashboard-ticket" aria-label={`${ticket.ticketNumber} — ${ticket.summary}`}><span className="dashboard-ticket-icon" aria-hidden="true">↗</span><span className="dashboard-ticket-main"><span className="dashboard-ticket-number">{ticket.ticketNumber}</span><span className="dashboard-ticket-summary" title={ticket.summary}>{ticket.summary}</span></span><span className={`dashboard-ticket-status dashboard-ticket-status-${ticket.status.toLowerCase()}`}>{statusLabel(ticket.status)}</span><span className="dashboard-ticket-time"><time dateTime={ticket.updatedAt}>{formatTime(ticket.updatedAt)}</time><span>Asia/Bangkok</span></span><span className="dashboard-ticket-arrow" aria-hidden="true">↗</span></Link></li>)}</ul>}</section>)}</div></>}
  </div>;
}
