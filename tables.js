Cells = new Meteor.Collection("cells")
UserSessions = new Meteor.Collection("user_sessions")

if (Meteor.isClient) {
  var table_id = document.location.pathname.split('/')[1].replace('.html', '')
  Meteor.subscribe('cells', table_id)
  Meteor.subscribe('users', table_id)
  Meteor.call('loginAnon')
  Meteor.setTimeout(function() {
    UserStatus.startMonitor({threshold: 2000, interval: 1000, idelOnBlur: true})
  }, 500)
  var LEFT_ARROW = 37
  var UP_ARROW = 38
  var RIGHT_ARROW = 39
  var DOWN_ARROW = 40
  var ENTER = 13
  var NCOLS = 15
  var NROWS = 50

  Template.rows.header = function() {
      var header = []
      for(var j = 0; j <= NCOLS; j++) {
        header.push({col: String.fromCharCode("A".charCodeAt(0)+j)})
      }
      return header
  }

  Template.rows.rendered = function() {
    $(document).keydown(function(event) {
      switch(event.which) {
      case ENTER:
        if($(event.target).is("input")) {
          $(event.target).trigger('blur')
        } else {
          $("#" + Session.get('focused_cell')).trigger("dblclick")
          event.preventDefault()
        }
        break
      case UP_ARROW:
      case DOWN_ARROW:
      case LEFT_ARROW:
      case RIGHT_ARROW:
        if($(event.target).is("input")) {
          return
        }
        event.preventDefault()
        var match = Session.get('focused_cell').match(/^(\w)(\d+)$/)
        var col_label = match[1].charCodeAt(0) - "A".charCodeAt(0)
        var row_label = parseInt(match[2])
        switch(event.which) {
        case UP_ARROW:
          row_label -= 1
          break
        case DOWN_ARROW:
          row_label += 1
          break
        case LEFT_ARROW:
          col_label -= 1
          break
        case RIGHT_ARROW:
          col_label += 1
          break
        }
        if (row_label < 1) {
          row_label = NROWS
        }
        if (col_label < 0) {
          col_label = NCOLS
        }
        if (row_label > NROWS) {
          row_label = 1
        }
        if (col_label > NCOLS) {
          col_label = 0
        }
        var col_label = String.fromCharCode("A".charCodeAt(0) + col_label)
        $("#" + col_label + row_label).trigger('click')
      }
    })
  }

  Template.cell.css_style = function() {
    var user = UserSessions.findOne({cell_id: this.id})
    if(user) {
      return 'background-color: #' + user.user_id
    }
    return ''
  }

  function getRange(start_col, start_row, end_col, end_row) {
    if(start_col === end_col) {
      cells = []
      start_row = parseInt(start_row)
      end_row = parseInt(end_row)
      if(end_row - start_row > 50) {
        return []
      }
      for(var i = start_row; i <= end_row; i++) {
        cells.push(start_col + i)
      }
      return cells
    } else if(start_row === end_row) {
      return []
    } else {
      return []
    }
  }

  function expandFunc(match, func, start_col, start_row, end_col, end_row) {
    var cells = getRange(start_col, start_row, end_col, end_row)
    switch(func) {
      case "SUM":
      return cells.join("+")
      break
      default:
      return "0"
    }
  }

  function lookupVar(match) {
    var cell = Cells.findOne({id: match})
    var value = (cell && cell.value) || '0'
    if(value[0] === '=') {
      value = value.substr(1)
    }
    return value
  }

  Template.cell.display = function() {
    if(this.value && this.value[0] === '=') {
      var result = this.value.substr(1)
      for(var i = 0; i < 10; i++) {
        if(result.match(/^[0-9./*+-]*$/)) {
          return eval(result)
        }
        result = result.replace(/([A-Z]+)\(([A-Z]+)([0-9]+):([A-Z]+)([0-9]+)\)/, expandFunc)
        result = result.replace(/[A-Z]+[0-9]+/, lookupVar)
      }
    }
    return this.value
  }

  Template.rows.rows = function() {
    var cells = Cells.find({})
    var D = {}
    cells.forEach(function(doc) {
      D[doc.id] = doc
    })

    var rows = []
    for(var i = 1; i <= NROWS; i++) {
      var row = []
      for(var j = 0; j <= NCOLS; j++) {
        var col_label = String.fromCharCode("A".charCodeAt(0)+j)
        if(D[col_label+i]) {
          row.push(D[col_label+i])
        } else {
          row.push({id: col_label+i})
        }
      }
      rows.push({cells: row, id: i})
    }
    return rows
  }

  Template.cell.events({
    'blur input': function(event) {
      var target = $(event.currentTarget)
      var parent = target.parent()
      parent.find('span').show()
      target.remove()

      var doc = {id: this.id, value: $(event.target).val(), table_id: table_id}
      if(this._id) {
        Cells.update({"_id": this._id}, doc)
      } else {
        Cells.insert(doc)
      }
    },
    'click td': function(event) {
      if(UserSessions.find({cell_id: this.id}).count() !== 0) {
        event.preventDefault()
        return
      }
      Session.set('focused_cell', this.id)
      Meteor.call('highlight', this.id, table_id)
    },
    'dblclick td': function(event) {
      if(Session.get('focused_cell') !== this.id) {
        event.preventDefault()
        return
      }
      var target = $(event.currentTarget)
      target.find('span').hide()
      target.append('<input type="text" class="form-inline">')
      target.find("input").trigger("focus").val(this.value)
    }
  })
}

if (Meteor.isServer) {
  function generateColor() {
    var chars = '0123456789ABCDEF'.split('')
    var result = ''
    for(var i = 0; i < 6; i++) {
      result += chars[Math.floor(Math.random() * chars.length)]
    }
    return result
  }

  Meteor.startup(function () {
    UserSessions.remove({})
    UserStatus.events.on('connectionLogout', function(data) {
      UserSessions.remove({user_id: data.userId})
    })
  });

  Meteor.publish('cells', function(table_id) {
    return Cells.find({table_id: table_id})
  })

  Meteor.publish('users', function(table_id) {
    return UserSessions.find({table_id: table_id})
  })

  Meteor.methods({
    highlight: function(cell_id, table_id) {
      UserSessions.update({user_id: this.userId, table_id: table_id},
        {cell_id: cell_id, user_id: this.userId, table_id: table_id}, {upsert: true})
    },
    loginAnon: function() {
      this._setUserId(generateColor())
    }
  })
}
