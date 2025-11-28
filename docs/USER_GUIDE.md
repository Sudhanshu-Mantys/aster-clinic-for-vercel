# Eligibility Checks - User Guide

## Quick Start

### Accessing the Feature
1. Log in to Aster Clinics portal
2. Click **"Eligibility Checks"** in the navigation menu
3. You'll see two tabs: **New Check** and **History**

---

## Running an Eligibility Check

### Single Check

1. Go to the **"New Check"** tab
2. Fill in patient details:
   - Select Insurance Provider (TPA)
   - Choose ID Type (Emirates ID, Member ID, etc.)
   - Enter ID Number
   - Select Visit Type
   - Fill additional fields as required
3. Click **"Check Eligibility"**
4. A modal will appear showing:
   - Real-time progress
   - Live screenshots from TPA portal
   - Documents being extracted
   - Polling attempts
5. You can **close the modal** - the check continues in the background!
6. View results in the **History** tab

### Multiple Parallel Checks 🚀

**You can run multiple checks at the same time!**

1. Submit the first check
2. Immediately submit another check (don't wait!)
3. Submit as many as needed
4. All checks run simultaneously
5. Monitor all of them in the **History** tab

**Example:**
```
10:00 AM - Start check for Patient A
10:00 AM - Start check for Patient B (don't wait!)
10:01 AM - Start check for Patient C
10:02 AM - Close browser and get coffee ☕
10:05 AM - Come back - all checks are complete!
```

---

## History Tab

### Overview
The History tab shows all your eligibility checks:
- ✅ Completed checks
- 🔄 Currently running checks
- ❌ Failed checks
- ⏳ Pending checks

### Features

#### Search
- Search by **Patient ID**
- Search by **Patient Name**
- Search by **Insurance Payer**

#### Filters
- **All** - Show everything
- **Active** - Only running checks
- **Completed** - Finished checks (success or error)

#### Auto-Refresh
- History updates automatically every 2 seconds
- See live progress of running checks
- No need to manually refresh

#### View Details
- Click any check to view detailed progress
- See live screenshots
- View extracted documents
- Monitor polling attempts

#### Actions
- **Delete** individual checks (hover over item)
- **Clear All** history (top-right button)

---

## Understanding Status Indicators

### Status Badges

| Badge | Meaning | Description |
|-------|---------|-------------|
| 🟡 **Pending** | Just started | Navigating to TPA portal |
| 🔵 **Processing** | In progress | Extracting eligibility data |
| 🟢 **Complete** | Done! | Check completed successfully |
| 🔴 **Error** | Failed | Something went wrong |

### Visual Indicators

- **Pulsing green dot** - Active checks are running
- **Spinning icon** - Check is processing
- **Checkmark** - Check completed
- **X icon** - Check failed

---

## Background Processing

### How It Works

**The key feature: checks continue even when you close the page!**

```
You submit a check
      ↓
Check starts running in background
      ↓
You can:
  • Close the modal ✅
  • Close the browser tab ✅
  • Refresh the page ✅
  • Start other checks ✅
      ↓
Come back later
      ↓
Results are waiting for you!
```

### What Persists

✅ **All check data** is saved to your browser  
✅ **Status updates** continue in background  
✅ **Screenshots** are captured and saved  
✅ **Documents** are tracked  
✅ **Results** persist across sessions  

### Important Notes

- Data is stored in **browser localStorage**
- **Per-browser** storage (doesn't sync across devices yet)
- Maximum **100 checks** stored
- Old checks (30+ days) are auto-deleted
- To free space, use **"Clear All"** button

---

## Real-Time Updates

### Live Screenshots
When a check is **Processing**, you'll see:
- 📸 **Screenshot** of the TPA portal being accessed
- Updates every 2 seconds
- Shows exactly what's happening

### Document Tracking
As documents are found:
- 📄 **Document name** appears
- 🔗 **View link** to open document
- 📝 **Document type** indicator

### Progress Bar
- **10%** - Task created
- **10-95%** - Processing (grows slowly)
- **100%** - Complete!

---

## Tips & Best Practices

### 🚀 Maximize Efficiency

1. **Batch Processing**
   - Submit multiple checks at once
   - Don't wait for one to finish
   - Check history later for results

2. **Use Search**
   - Find specific patients quickly
   - Filter by payer to group results
   - Use status filter to focus on active checks

3. **Monitor Progress**
   - Keep History tab open in another tab
   - Auto-refresh shows live updates
   - Click any check to see details

### ⚡ Power User Tips

1. **Quick Submit Pattern**
   ```
   Submit → Submit → Submit → Check History
   (Don't watch progress for each one)
   ```

2. **Morning Batch**
   ```
   Start of day: Submit 10 checks
   Get coffee ☕
   Come back: All done!
   ```

3. **Context Switching**
   ```
   Submit check → Do other work → Check back later
   No need to wait!
   ```

### ⚠️ Things to Remember

- Each check takes **2-5 minutes**
- Maximum **150 polling attempts** (5 min timeout)
- Data stored in **browser only** (for now)
- **Clear old checks** periodically
- **Close modal** if you don't want to watch

---

## Troubleshooting

### Check Stuck on "Pending"
**Possible causes:**
- TPA portal is slow
- Network connectivity issue
- Backend service delay

**What to do:**
- Wait 1-2 minutes
- Refresh the page
- Check if still pending
- If stuck > 5 min, will auto-timeout

### Check Failed with Error
**Possible causes:**
- Invalid patient ID
- Insurance not found
- TPA portal error
- Network timeout

**What to do:**
- Read error message
- Verify patient details
- Try again with correct info
- Contact support if persists

### History Not Showing
**Possible causes:**
- Browser localStorage disabled
- Storage quota exceeded
- Browser cache issue

**What to do:**
- Enable localStorage in browser settings
- Clear old checks (use "Clear All")
- Clear browser cache
- Try different browser

### Screenshots Not Loading
**Possible causes:**
- Large image size
- Storage quota full
- Network issue

**What to do:**
- Wait a few seconds (may be loading)
- Refresh the page
- Clear old checks to free space

---

## FAQ

### Q: Can I close the browser after submitting a check?
**A:** Yes! The check continues in the background. Results will be waiting when you return.

### Q: How many checks can I run at once?
**A:** You can run multiple checks simultaneously. Recommend keeping under 10 concurrent checks for best performance.

### Q: How long are checks stored?
**A:** Checks are stored for 30 days, then automatically deleted. You can manually delete anytime.

### Q: Can I see checks from my phone?
**A:** Currently no - data is per-browser. Backend sync coming soon!

### Q: What if I accidentally delete a check?
**A:** Deletion is permanent (from browser storage). You'll need to run the check again.

### Q: Can team members see my checks?
**A:** Not yet - coming soon! Currently each browser has its own history.

### Q: How do I get notified when a check completes?
**A:** Browser notifications are planned for future release. For now, check the History tab.

### Q: Why do some checks take longer than others?
**A:** Depends on:
- TPA response time
- Network speed
- Number of documents to extract
- Portal complexity

### Q: Can I export my history?
**A:** Export feature coming soon! For now, you can view and search within the app.

---

## Keyboard Shortcuts (Coming Soon)

- `Ctrl/Cmd + K` - Focus search bar
- `Ctrl/Cmd + N` - New check
- `Ctrl/Cmd + H` - Go to history
- `Escape` - Close modal

---

## Support

### Need Help?
- Check this guide first
- Look at error messages carefully
- Try refreshing the page
- Clear browser cache

### Report Issues
- Note what you were doing
- Copy any error messages
- Check browser console (F12)
- Contact support team

### Feature Requests
- We're constantly improving!
- Share your ideas with the team
- Check roadmap for planned features

---

## What's Next?

### Coming Soon 🎉

- **Backend Storage** - Access history from any device
- **Team Sharing** - Share checks with colleagues
- **Notifications** - Get alerts when checks complete
- **Batch Upload** - Submit CSV of patients
- **Reports** - Export history to Excel
- **Analytics** - Success rates and insights

### Stay Updated
- Check release notes
- Watch for new features
- Provide feedback!

---

## Quick Reference Card

```
┌──────────────────────────────────────────────────┐
│          ELIGIBILITY CHECKS CHEAT SHEET          │
├──────────────────────────────────────────────────┤
│                                                  │
│  START CHECK:     New Check tab → Fill → Submit │
│  MULTIPLE:        Submit → Submit → Submit      │
│  VIEW ALL:        History tab                   │
│  SEARCH:          Type in search bar            │
│  FILTER:          All / Active / Completed      │
│  DETAILS:         Click any check               │
│  DELETE:          Hover → Delete button         │
│  CLEAR:           Clear All button              │
│                                                  │
│  💡 TIP: You can close the modal/tab!          │
│     Checks continue in background.              │
│                                                  │
└──────────────────────────────────────────────────┘
```

---

## Summary

The new Eligibility Checks feature provides:

✅ **Real-time visual feedback** - See screenshots and documents  
✅ **Background processing** - Close tabs, checks continue  
✅ **Parallel execution** - Run multiple checks at once  
✅ **Complete history** - Search and filter all checks  
✅ **Persistent storage** - Survives page refreshes  

**The Bottom Line:**  
Submit your checks and go do other work. No more watching progress bars! 🎉

---

*Last Updated: January 2024*
*Version: 1.0*